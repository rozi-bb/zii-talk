import { Icon } from './icons';
import type { Topic } from '../lib/api';
import { statusText } from '../lib/topics';

/* Kartu topik di Latihan — juga dipakai buat pratinjau di form Tambah topik. */
export function TopicCard({
  topic,
  categoryName,
  onStart,
  disabled = false,
}: {
  topic: Topic;
  categoryName: string;
  onStart?: () => void;
  disabled?: boolean;
}) {
  return (
    <article className="tcard">
      <div className="tcard-top">
        <i className="tico" style={{ background: topic.tint, color: topic.ink }}>
          <Icon name={topic.icon} size={20} />
        </i>
        <span className="tcard-cat">{categoryName}</span>
      </div>
      <h3>{topic.name}</h3>
      {topic.blurb && <p>{topic.blurb}</p>}
      <div className="tcard-foot">
        <span className={`tcard-status${topic.tests ? ' done' : ''}`}>{statusText(topic)}</span>
        {onStart && (
          <button
            className="btn primary sm"
            onClick={onStart}
            disabled={disabled}
            aria-label={`Mulai sesi ${topic.name}`}
          >
            <Icon name="mic" size={15} />
            Mulai
          </button>
        )}
      </div>
    </article>
  );
}
