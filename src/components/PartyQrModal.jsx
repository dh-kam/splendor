import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, Cast, Tv, Users, Sparkles, Play } from 'lucide-react';
import { MAX_PARTY_PLAYERS } from '../utils/castBridge';

/**
 * Phone-side Party Invite QR & Chromecast Connection Modal.
 * Lets the host (Player 1) invite up to 3 additional friends (max 4 total) via QR scan
 * and push the matching TV board view to Chromecast.
 */
export function PartyQrModal({
  roomCode,
  joinUrl,
  tvUrl,
  players = [],
  hostId,
  myId,
  gameStatus = 'lobby',
  maxPlayers = MAX_PARTY_PLAYERS,
  hasAndroidBridge = false,
  castConnected = false,
  onCastToTv,
  onAddAi,
  onStartGame,
  onClose,
}) {
  const [copiedKey, setCopiedKey] = useState(null);

  const isHost = Boolean(hostId && myId && hostId === myId);
  const currentCount = players.length;
  const remainingSlots = Math.max(0, maxPlayers - currentCount);
  const maxGuests = Math.max(0, maxPlayers - 1);

  const copyText = async (text, key) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
      }
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr));
      }, 1800);
    } catch {
      setCopiedKey(null);
    }
  };

  return (
    <div
      className="steam-modal-backdrop party-qr-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="친구 초대 QR 코드 및 TV 연결"
      data-testid="party-qr-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="steam-modal-card party-qr-card">
        <div className="party-qr-header">
          <div className="party-qr-title-wrap">
            <span className="party-qr-kicker">
              <Users size={13} aria-hidden="true" />
              본인 포함 최대 {maxPlayers}명 · 친구 최대 {maxGuests}명 초대
            </span>
            <h2 className="modal-title" style={{ textAlign: 'left', margin: 0 }}>
              파티 참가 QR 코드
            </h2>
          </div>
          <button
            type="button"
            className="party-qr-close-btn"
            aria-label="QR 초대 창 닫기"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Room Code Pill + Scannable QR */}
        <div className="party-qr-code-stage">
          <div className="party-room-code-bar">
            <span className="party-room-code-label">방 코드</span>
            <strong className="party-room-code-val numeric" data-testid="party-room-code">
              {roomCode}
            </strong>
            <button
              type="button"
              className="party-copy-mini-btn"
              onClick={() => copyText(joinUrl, 'join')}
            >
              {copiedKey === 'join' ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedKey === 'join' ? '복사됨' : '링크 복사'}</span>
            </button>
          </div>

          <div className="qr-frame party-qr-frame" data-testid="party-qr-svg">
            <QRCodeSVG value={joinUrl} size={152} level="M" includeMargin={false} />
          </div>

          <p className="party-qr-caption">
            친구 스마트폰 카메라로 QR 코드를 스캔하면 앱 설치 없이 바로 참가합니다.
          </p>
        </div>

        {/* Live 4-seat Party Roster */}
        <div className="party-roster-box">
          <div className="party-roster-head">
            <span>참가 상인 현황</span>
            <span className="numeric party-roster-count" data-testid="party-roster-count">
              {currentCount} / {maxPlayers}명
              {remainingSlots > 0 ? ` (${remainingSlots}자리 남음)` : ' (정원 마감)'}
            </span>
          </div>
          <div className="party-roster-list">
            {Array.from({ length: maxPlayers }).map((_, idx) => {
              const p = players[idx];
              if (!p) {
                return (
                  <div key={`empty-${idx}`} className="party-seat-row is-empty">
                    <span className="party-seat-num numeric">{idx + 1}</span>
                    <span className="party-seat-empty-text">QR 초대 대기 중...</span>
                  </div>
                );
              }
              const isSeatHost = p.id === hostId;
              const isSeatMe = p.id === myId;
              return (
                <div key={p.id} className={`party-seat-row ${isSeatHost ? 'is-host' : ''}`}>
                  <span className="party-seat-num numeric">{idx + 1}</span>
                  <span className="party-seat-name">{p.name}</span>
                  <span className="party-seat-tags">
                    {isSeatHost && <span className="party-seat-badge is-host">방장</span>}
                    {isSeatMe && !isSeatHost && <span className="party-seat-badge">나</span>}
                    {p.isAi && <span className="party-seat-badge is-ai">AI</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chromecast / TV Board Connection */}
        <div className="party-cast-panel">
          <div className="party-cast-info">
            <div className="party-cast-title">
              <Cast size={15} aria-hidden="true" />
              <span>Chromecast · TV 보드 연결</span>
            </div>
            <span className="party-cast-sub">
              {castConnected
                ? 'Chromecast TV와 실시간 동기화 중입니다.'
                : hasAndroidBridge
                  ? 'Chromecast 기기를 선택하면 현재 게임 보드가 TV에 바로 표시됩니다.'
                  : 'TV 브라우저나 Chromecast Receiver에서 아래 보드 주소를 열면 실시간 연동됩니다.'}
            </span>
          </div>
          <div className="party-cast-actions">
            {hasAndroidBridge ? (
              <button
                type="button"
                className="party-cast-btn"
                onClick={onCastToTv}
              >
                <Tv size={15} aria-hidden="true" />
                <span>{castConnected ? 'TV 화면 다시 보내기' : 'Chromecast 연결'}</span>
              </button>
            ) : (
              <button
                type="button"
                className="party-cast-btn"
                onClick={() => copyText(tvUrl, 'tv')}
              >
                {copiedKey === 'tv' ? <Check size={15} /> : <Tv size={15} />}
                <span>{copiedKey === 'tv' ? 'TV 주소 복사됨' : 'TV 보드 링크 복사'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Host Lobby Action Footer */}
        {gameStatus === 'lobby' && isHost && (
          <div className="party-qr-footer-actions">
            {remainingSlots > 0 && (
              <button
                type="button"
                className="btn-gilded-secondary"
                onClick={onAddAi}
              >
                <Sparkles size={15} aria-hidden="true" />
                AI 상인 추가
              </button>
            )}
            <button
              type="button"
              className="btn-gilded-primary"
              disabled={currentCount < 2}
              onClick={() => {
                onStartGame?.();
                onClose?.();
              }}
            >
              <Play size={16} aria-hidden="true" />
              게임 시작 ({currentCount}인)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
