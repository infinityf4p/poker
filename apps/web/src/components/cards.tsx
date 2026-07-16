import type { Card } from '@poker-with-friends/protocol';
import { cardRankLabel } from '../poker-ui';

/**
 * A face-up playing card. Cards animate in with a staggered "deal" motion by
 * default; pass `still` for static contexts (e.g. hand history) where a
 * replayed deal animation would be misleading.
 */
export function PlayingCard({
  card,
  compact = false,
  dealIndex = 0,
  still = false,
}: {
  card: Card;
  compact?: boolean;
  dealIndex?: number;
  still?: boolean;
}) {
  const suit = card.slice(-1).toLowerCase();
  const rank = cardRankLabel(card);
  const symbol: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const suitName: Record<string, string> = { s: '黑桃', h: '红桃', d: '方片', c: '梅花' };
  const normalizedDealIndex = Math.max(0, Math.min(4, Math.trunc(dealIndex)));
  const motionClass = still ? 'playing-card--still' : `playing-card--deal-${normalizedDealIndex}`;
  return (
    <span
      className={`playing-card ${motionClass} ${compact ? 'playing-card--compact' : ''} ${suit === 'h' || suit === 'd' ? 'playing-card--red' : ''}`}
      role="img"
      aria-label={`${suitName[suit]} ${rank}`}
    >
      <b>{rank}</b>
      <i>{symbol[suit]}</i>
    </span>
  );
}
