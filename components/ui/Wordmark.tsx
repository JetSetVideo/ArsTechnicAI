import Link from 'next/link';
import styles from '@/styles/wordmark.module.css';

interface WordmarkProps {
  /** Pass null to render the mark without a link (sign-in dialog). */
  href?: string | null;
  className?: string;
  title?: string;
}

/** One wordmark for home, the workshop, and the public pages. */
export function Wordmark({ href = '/home', className, title = 'Dashboard Home' }: WordmarkProps) {
  const classNames = [styles.mark, className].filter(Boolean).join(' ');
  const inner = (
    <>
      <span className={styles.ars}>Ars</span>
      <span className={styles.technic}>Technic</span>
      <span className={styles.ai}>AI</span>
    </>
  );
  if (href === null) {
    return <span className={classNames}>{inner}</span>;
  }
  return (
    <Link href={href} className={classNames} title={title}>
      {inner}
    </Link>
  );
}
