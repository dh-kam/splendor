import { Volume2, VolumeX, Check, X, Music } from 'lucide-react';
import { SOUND_THEME_LIST } from '../utils/soundThemes';
import {
  playCardSelect,
  playChipCollect,
  playVictoryFanfare,
} from '../utils/soundFx';

export function SoundThemePopover({
  soundTheme,
  onSelectTheme,
  muted,
  onToggleMute,
  volume,
  onVolumeChange,
  onClose,
  placement = 'dock',
}) {
  const volumePct = Math.round((muted ? 0 : volume) * 100);

  const audition = (kind) => {
    if (muted) onToggleMute();
    if (kind === 'card') {
      playCardSelect(false, 2, 1, soundTheme);
    } else if (kind === 'chip') {
      playChipCollect(false, ['white', 'blue', 'green'], 1, soundTheme);
    } else if (kind === 'victory') {
      playVictoryFanfare(false, true, soundTheme);
    }
  };

  return (
    <aside
      className={`sound-theme-popover is-${placement}`}
      role="dialog"
      aria-label="르네상스 음향 설정"
    >
      <div className="sound-popover-header">
        <span className="sound-popover-title">
          <Music size={16} aria-hidden="true" />
          르네상스 음향 테마
        </span>
        <button
          type="button"
          className="dock-icon-btn sound-close-btn"
          onClick={onClose}
          aria-label="음향 설정 닫기"
        >
          <X size={15} />
        </button>
      </div>

      <div className="sound-popover-body">
        <div
          className="sound-theme-list"
          role="radiogroup"
          aria-label="음향 테마 선택"
        >
          {SOUND_THEME_LIST.map((theme) => {
            const active = soundTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`sound-theme-option ${active ? 'is-active' : ''}`}
                onClick={() => onSelectTheme(theme.id)}
              >
                <span className="sound-theme-text">
                  <span className="sound-theme-name">{theme.name}</span>
                  <span className="sound-theme-sub">{theme.subtitle}</span>
                </span>
                <span className="sound-theme-check" aria-hidden="true">
                  {active ? <Check size={16} /> : null}
                </span>
              </button>
            );
          })}
        </div>

        <div className="sound-volume-row">
          <button
            type="button"
            className={`sound-mute-btn ${muted ? 'is-muted' : ''}`}
            onClick={onToggleMute}
            aria-label={muted ? '효과음 켜기' : '효과음 끄기'}
            title={muted ? '효과음 켜기 (M)' : '효과음 끄기 (M)'}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={volumePct}
            onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
            className="sound-volume-slider"
            aria-label="효과음 음량"
          />
          <span className="sound-volume-val numeric">{volumePct}%</span>
        </div>

        <div className="sound-preview-section">
          <span className="sound-preview-label">테마 미리 듣기</span>
          <div className="sound-preview-row">
            <button
              type="button"
              className="sound-preview-btn"
              onClick={() => audition('card')}
            >
              카드 선택
            </button>
            <button
              type="button"
              className="sound-preview-btn"
              onClick={() => audition('chip')}
            >
              보석 채집
            </button>
            <button
              type="button"
              className="sound-preview-btn"
              onClick={() => audition('victory')}
            >
              승리 알림
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
