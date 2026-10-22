import { useI18n } from '../i18n/context';
import StateIcon from './StateIcon';
import { TONE_TEXT } from './tones';
import { dateTime } from './format';

/**
 * The state of a service or pipeline card. When the published data is stale (`asOf` set to its
 * generatedAt), the state is drawn in the neutral tone and dated, like the banner's "last known
 * status": a green "Up" from hours ago would claim more than the data says.
 */
const StateLabel = ({ tone, label, asOf }) => {
  const { t, lang } = useI18n();
  const shown = asOf ? 'neutral' : tone;
  return (
    <div>
      <p className={`flex items-center gap-1.5 font-semibold ${TONE_TEXT[shown]}`}>
        <StateIcon tone={shown} />
        {label}
      </p>
      {asOf && (
        <p className='mt-0.5 text-xs text-foreground-muted'>
          <time dateTime={asOf}>{t('statuspage.asOf', { time: dateTime(asOf, lang) })}</time>
        </p>
      )}
    </div>
  );
};

export default StateLabel;
