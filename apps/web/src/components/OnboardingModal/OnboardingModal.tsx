import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import { Pill } from '../Pill/Pill';
import { Button } from '../Button/Button';
import { BikeMark } from '../BikeMark/BikeMark';
import type { AthleteProfile } from '../../hooks/useAthleteProfile';
import styles from './OnboardingModal.module.css';

interface OnboardingModalProps {
  open: boolean;
  initial: AthleteProfile;
  onSave: (next: { ftp: number; weight: number; hrMax: number }) => void;
  onSkip: () => void;
}

/**
 * OnboardingModal — first-run capture of FTP, weight, HR max so PMC math
 * + zone classification turn real instead of duration-based proxies.
 * Modal-style overlay with click-outside + ESC dismiss (which counts as Skip).
 */
export function OnboardingModal({ open, initial, onSave, onSkip }: OnboardingModalProps) {
  const [ftp, setFtp] = useState<string>(initial.ftp?.toString() ?? '');
  const [weight, setWeight] = useState<string>(initial.weight?.toString() ?? '');
  const [hrMax, setHrMax] = useState<string>(initial.hrMax?.toString() ?? '');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onSkip]);

  const ftpNum = Number.parseInt(ftp, 10);
  const weightNum = Number.parseFloat(weight);
  const hrNum = Number.parseInt(hrMax, 10);
  const allValid =
    ftpNum > 0 && ftpNum < 600 && weightNum > 30 && weightNum < 200 && hrNum > 100 && hrNum < 230;
  const wPerKg = ftpNum > 0 && weightNum > 0 ? (ftpNum / weightNum).toFixed(2) : null;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onSkip}
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-title"
        >
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className={styles.head}>
              <BikeMark size={32} />
              <div>
                <Eyebrow rule tone="accent">First run</Eyebrow>
                <h2 id="onboarding-title" className={styles.title}>
                  Quick <em>setup</em>.
                </h2>
              </div>
            </header>

            <p className={styles.lede}>
              Three numbers and your PMC turns from a duration proxy into real TSS · CTL · ATL · TSB.
              All of this stays in your browser.
            </p>

            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                if (!allValid) return;
                onSave({ ftp: ftpNum, weight: weightNum, hrMax: hrNum });
              }}
            >
              <Field
                label="FTP"
                hint="Functional Threshold Power — your 1-hour all-out wattage."
                unit="W"
              >
                <input
                  type="number"
                  inputMode="numeric"
                  min={50}
                  max={600}
                  step={1}
                  required
                  placeholder="285"
                  value={ftp}
                  onChange={(e) => setFtp(e.target.value)}
                  className={styles.input}
                  autoFocus
                />
              </Field>

              <Field label="Weight" hint="Kilograms — used for W/kg." unit="kg">
                <input
                  type="number"
                  inputMode="decimal"
                  min={30}
                  max={200}
                  step={0.1}
                  required
                  placeholder="72"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className={styles.input}
                />
              </Field>

              <Field
                label="HR max"
                hint="Maximum heart rate (lab-tested or 220 − age estimate)."
                unit="bpm"
              >
                <input
                  type="number"
                  inputMode="numeric"
                  min={120}
                  max={230}
                  step={1}
                  required
                  placeholder="188"
                  value={hrMax}
                  onChange={(e) => setHrMax(e.target.value)}
                  className={styles.input}
                />
              </Field>

              {wPerKg ? (
                <div className={styles.wkg}>
                  <Pill tone="accent">W/kg · {wPerKg}</Pill>
                  <span>You're a {wkgClass(Number(wPerKg))} rider.</span>
                </div>
              ) : null}

              <div className={styles.actions}>
                <Button type="submit" variant="primary" size="md" withArrow disabled={!allValid}>
                  Save profile
                </Button>
                <button type="button" className={styles.skipBtn} onClick={onSkip}>
                  I'll set this later
                </button>
              </div>
            </form>

            <footer className={styles.foot}>
              You can change these any time from the user menu → "Edit profile".
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Field({
  label,
  hint,
  unit,
  children,
}: {
  label: string;
  hint: string;
  unit: string;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.field}>
      <div className={styles.fieldHead}>
        <span className={styles.fieldLabel}>{label}</span>
        <span className={styles.fieldUnit}>{unit}</span>
      </div>
      {children}
      <span className={styles.fieldHint}>{hint}</span>
    </label>
  );
}

function wkgClass(wkg: number): string {
  if (wkg >= 5.0) return 'world-class';
  if (wkg >= 4.5) return 'cat-1 / pro';
  if (wkg >= 4.0) return 'cat-2 / strong amateur';
  if (wkg >= 3.5) return 'cat-3 / committed amateur';
  if (wkg >= 3.0) return 'cat-4 / fit amateur';
  return 'developing';
}
