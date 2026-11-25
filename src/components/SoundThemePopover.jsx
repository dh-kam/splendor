import { Volume2, VolumeX, Check, X, Music } from 'lucide-react';
import { SOUND_THEME_LIST } from '../utils/soundThemes';
import {
  playChipPick,
  playChipCollect,
  playChipReturn,
  playCardBuy,
  playCardDeal,
} from '../utils/soundFx';

export function SoundThemePopover({
  soundTheme,
  onSelectTheme,
  bgmEnabled,
  onToggleBgm,
  bgmVolume,
  onBgmVolumeChange,
  muted,
  onToggleMute,
  volume,
  onVolumeChange,
  onClose,
  placement = 'dock',
}) {
  const bgmPct = Math.round((bgmEnabled ? bgmVolume : 0) * 100);
  const sfxPct = Math.round((muted ? 0 : volume) * 100);

  const audition = (kind) => {
    if (muted) onToggleMute();
    if (kind === 'pick') {
      playChipPick(false, 'blue', 1, 1, soundTheme);
    } else if (kind === 'collect') {
      playChipCollect(false, ['white', 'blue', 'green'], 1, soundTheme);
    } else if (kind === 'return') {
      playChipReturn(false, ['red', 'black'], 1, soundTheme);
    } else if (kind === 'flip') {
      playCardDeal(false, 0.95, 0, soundTheme);
    } else if (kind === 'buy') {
      playCardBuy(false, 1, soundTheme);
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
          르네상스 음향 · BGM
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
        {/* 1. Background Music (BGM) Toggle & Volume */}
        <div className="sound-mixer-group">
          <div className="sound-mixer-label-row">
            <span className="sound-mixer-label">배경음악 (BGM)</span>
            <button
              type="button"
              className={`sound-toggle-pill ${bgmEnabled ? 'is-on' : 'is-off'}`}
              data-popover-bgm-toggle="true"
              onClick={onToggleBgm}
              aria-pressed={bgmEnabled}
            >
              {bgmEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="sound-volume-row">
            <button
              type="button"
              className={`sound-mute-btn ${!bgmEnabled ? 'is-muted' : ''}`}
              onClick={onToggleBgm}
              aria-label={bgmEnabled ? '배경음악 끄기' : '배경음악 켜기'}
              title={bgmEnabled ? '배경음악 끄기 (B)' : '배경음악 켜기 (B)'}
            >
              <Music size={15} />
            </button>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={bgmPct}
              onChange={(e) => onBgmVolumeChange(Number(e.target.value) / 100)}
              className="sound-volume-slider"
              aria-label="배경음악 음량"
            />
            <span className="sound-volume-val numeric">{bgmPct}%</span>
          </div>
        </div>

        {/* 2. Sound Effects (SFX) Toggle & Volume */}
        <div className="sound-mixer-group">
          <div className="sound-mixer-label-row">
            <span className="sound-mixer-label">효과음 (SFX)</span>
            <button
              type="button"
              className={`sound-toggle-pill ${!muted ? 'is-on' : 'is-off'}`}
              data-popover-sfx-toggle="true"
              onClick={onToggleMute}
              aria-pressed={!muted}
            >
              {muted ? 'OFF' : 'ON'}
            </button>
          </div>
          <div className="sound-volume-row">
            <button
              type="button"
              className={`sound-mute-btn ${muted ? 'is-muted' : ''}`}
              onClick={onToggleMute}
              aria-label={muted ? '효과음 켜기' : '효과음 끄기'}
              title={muted ? '효과음 켜기 (M)' : '효과음 끄기 (M)'}
            >
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={sfxPct}
              onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
              className="sound-volume-slider"
              aria-label="효과음 음량"
            />
            <span className="sound-volume-val numeric">{sfxPct}%</span>
          </div>
        </div>

        {/* 3. Selectable Renaissance Theme (applies to both BGM & SFX) */}
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

        {/* 4. Tabletop SFX Audition Buttons */}
        <div className="sound-preview-section">
          <span className="sound-preview-label">동작 효과음 미리 듣기</span>
          <div className="sound-preview-row">
            <button
              type="button"
              className="sound-preview-btn"
              onClick={() => audition('pick')}
            >
              칩 선택
            </button>
            <button
              type="button"
              className="sound-preview-btn"
              onClick={() => audition('collect')}
            >
              칩 채집
            </button>
            <button
              type="button"
              className="sound-preview-btn"
              onClick={() => audition('return')}
            >
              칩 반납
            </button>
            <button
              type="button"
              className="sound-preview-btn"
              onClick={() => audition('flip')}
            >
              카드 뒤집기
            </button>
            <button
              type="button"
              className="sound-preview-btn"
              onClick={() => audition('buy')}
            >
              카드 구매
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
