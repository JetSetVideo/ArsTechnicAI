/**
 * Patch Next.js for Deno Compatibility
 * 
 * This script patches Next.js's error overlay to handle chalk compatibility
 * issues that occur when running Next.js with Deno instead of Node.js.
 * 
 * The issue: Babel's code-frame highlighting uses chalk for terminal colors,
 * but chalk's methods (like 'bold') aren't properly initialized in Deno,
 * causing "Cannot read properties of undefined (reading 'bold')" errors.
 * 
 * Run this after `deno install`:
 *   deno run -A scripts/patch-nextjs.ts
 * 
 * Or use:
 *   deno task postinstall
 */

const SHARED_JS_PATH = "node_modules/.deno/next@14.2.15/node_modules/next/dist/client/components/react-dev-overlay/server/shared.js";

const PATCH_MARKER = "// DENO_COMPAT:";

// The original problematic code
const ORIGINAL_CODE = `function getOriginalCodeFrame(frame, source) {
    var _frame_file;
    if (!source || ((_frame_file = frame.file) == null ? void 0 : _frame_file.includes("node_modules")) || isInternal(frame.file)) {
        return null;
    }
    var _frame_lineNumber, _frame_column;
    return (0, _codeframe.codeFrameColumns)(source, {
        start: {
            // 1-based, but -1 means start line without highlighting
            line: (_frame_lineNumber = frame.lineNumber) != null ? _frame_lineNumber : -1,
            // 1-based, but 0 means whole line without column highlighting
            column: (_frame_column = frame.column) != null ? _frame_column : 0
        }
    }, {
        forceColor: true
    });
}`;

// The patched code with Deno compatibility
const PATCHED_CODE = `function getOriginalCodeFrame(frame, source) {
    var _frame_file;
    if (!source || ((_frame_file = frame.file) == null ? void 0 : _frame_file.includes("node_modules")) || isInternal(frame.file)) {
        return null;
    }
    var _frame_lineNumber, _frame_column;
    // DENO_COMPAT: Wrap in try-catch to handle chalk compatibility issues in Deno
    try {
        return (0, _codeframe.codeFrameColumns)(source, {
            start: {
                // 1-based, but -1 means start line without highlighting
                line: (_frame_lineNumber = frame.lineNumber) != null ? _frame_lineNumber : -1,
                // 1-based, but 0 means whole line without column highlighting
                column: (_frame_column = frame.column) != null ? _frame_column : 0
            }
        }, {
            forceColor: false  // DENO_COMPAT: Disabled to prevent chalk errors in Deno runtime
        });
    } catch (e) {
        // Fallback: return source without highlighting if chalk fails
        return null;
    }
}`;

async function patchFile(filePath: string): Promise<boolean> {
  try {
    const content = await Deno.readTextFile(filePath);
    
    // Check if already patched
    if (content.includes(PATCH_MARKER)) {
      console.log(`✓ ${filePath} is already patched`);
      return true;
    }
    
    // Check if the original code exists
    if (!content.includes("forceColor: true")) {
      console.log(`⚠ ${filePath} doesn't contain expected code pattern`);
      return false;
    }
    
    // Apply patch
    const patched = content.replace(ORIGINAL_CODE, PATCHED_CODE);
    
    if (patched === content) {
      console.log(`⚠ ${filePath} patch pattern didn't match exactly, trying alternative...`);
      
      // Try a simpler replacement - just change forceColor: true to false
      const simplePatch = content.replace(
        /forceColor:\s*true/g, 
        "forceColor: false  // DENO_COMPAT: Disabled to prevent chalk errors"
      );
      
      if (simplePatch !== content) {
        await Deno.writeTextFile(filePath, simplePatch);
        console.log(`✓ Applied simple patch to ${filePath}`);
        return true;
      }
      
      return false;
    }
    
    await Deno.writeTextFile(filePath, patched);
    console.log(`✓ Successfully patched ${filePath}`);
    return true;
    
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.log(`✗ File not found: ${filePath}`);
      console.log("  Run 'deno install' first to install dependencies.");
    } else {
      console.error(`✗ Error patching ${filePath}:`, error);
    }
    return false;
  }
}

async function main() {
  console.log("=== Next.js Deno Compatibility Patcher ===\n");
  console.log("Patching files to fix 'Failed to parse source map' errors...\n");
  
  const results = await Promise.all([
    patchFile(SHARED_JS_PATH),
  ]);
  
  const allSuccess = results.every(r => r);
  
  console.log("\n" + "=".repeat(45));
  if (allSuccess) {
    console.log("✓ All patches applied successfully!");
    console.log("\nYou can now run: deno task dev");
  } else {
    console.log("⚠ Some patches failed. Check the output above.");
    Deno.exit(1);
  }
}

main();
