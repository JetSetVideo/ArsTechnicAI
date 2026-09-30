"""cpe_reference.py — run the ORIGINAL Python rules engine, for the port to be diffed against.

This is not part of the app. It exists so `tests/cinema_parity_test.ts` can put
the same configurations through Director's Console's `cinema_rules` and through
`core/cinema/rules.ts` and assert the two agree message for message.

It reads one JSON array of configs on stdin and writes one JSON array of
results on stdout. Field names are the Python schema's own snake_case, so this
file does no translation and cannot introduce a difference of its own.

Usage (from the repo root, with the original checkout present):

    CPE_ROOT=~/Desktop/DirectorsConsole/CinemaPromptEngineering \
      "$CPE_ROOT/venv/bin/python" tests/parity/cpe_reference.py < configs.json
"""
import json
import os
import sys

CPE_ROOT = os.environ.get("CPE_ROOT")
if CPE_ROOT:
    sys.path.insert(0, CPE_ROOT)

from cinema_rules.rules.engine import RuleEngine          # noqa: E402
from cinema_rules.prompts.generator import PromptGenerator   # noqa: E402
from cinema_rules.schemas.live_action import LiveActionConfig  # noqa: E402
from cinema_rules.schemas.animation import AnimationConfig     # noqa: E402


def _prompts(config, is_live):
    """Every target x detail level, so the port is compared on all of them."""
    targets = ["generic", "midjourney", "flux", "wan2.2", "runway", "pika",
               "cogvideo", "hunyuan", "mochi", "ltx", "sdxl"]
    out = {}
    for target in targets:
        gen = PromptGenerator(target)
        if is_live:
            out[target] = {
                "brief": gen.generate_live_action_prompt(config),
                "detailed": gen.generate_live_action_prompt_detailed(config),
                "negative": gen.get_negative_prompt(),
            }
        else:
            out[target] = {
                "brief": gen.generate_animation_prompt(config),
                "detailed": gen.generate_animation_prompt(config),
                "negative": gen.get_negative_prompt(),
            }
    return out


def run(payload):
    engine = RuleEngine()
    out = []
    for item in payload:
        is_live = item["mode"] == "live_action"
        if is_live:
            config = LiveActionConfig(**{k: v for k, v in item.items() if k != "mode"})
            result = engine.validate_live_action(config)
        else:
            config = AnimationConfig(**{k: v for k, v in item.items() if k != "mode"})
            result = engine.validate_animation(config)
        out.append({
            "prompts": _prompts(config, is_live),
            "status": result.status,
            "messages": [
                {
                    "ruleId": m.rule_id,
                    "severity": m.severity.value if hasattr(m.severity, "value") else m.severity,
                    "message": m.message,
                    "fieldPath": m.field_path,
                }
                for m in result.messages
            ],
        })
    return out


def apply_presets():
    """Every preset, applied — the function that turns a movie card into a shot."""
    from cinema_rules.presets import LIVE_ACTION_PRESETS, ANIMATION_PRESETS
    engine = RuleEngine()
    out = {}
    for pid in LIVE_ACTION_PRESETS:
        config, validation = engine.apply_live_action_preset(pid)
        out["live_action:" + pid] = {
            "config": json.loads(config.model_dump_json()),
            "messages": [
                {"ruleId": m.rule_id, "severity":
                    m.severity.value if hasattr(m.severity, "value") else m.severity,
                 "message": m.message, "fieldPath": m.field_path}
                for m in validation.messages
            ],
        }
    for pid in ANIMATION_PRESETS:
        config, validation = engine.apply_animation_preset(pid)
        out["animation:" + pid] = {
            "config": json.loads(config.model_dump_json()),
            "messages": [
                {"ruleId": m.rule_id, "severity":
                    m.severity.value if hasattr(m.severity, "value") else m.severity,
                 "message": m.message, "fieldPath": m.field_path}
                for m in validation.messages
            ],
        }
    return out


if __name__ == "__main__":
    if "--apply-presets" in sys.argv:
        json.dump(apply_presets(), sys.stdout)
    else:
        json.dump(run(json.load(sys.stdin)), sys.stdout)
