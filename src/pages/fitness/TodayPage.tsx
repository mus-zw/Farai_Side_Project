import TodayHero from '../../components/fitness/TodayHero';
import BackupNudge from '../../components/fitness/BackupNudge';

/** Today: how the day is going and the next thing to do. Logging itself lives in Train and Nutrition. */
export default function TodayPage() {
  return (
    <div className="space-y-4">
      <TodayHero />
      <BackupNudge />
    </div>
  );
}
