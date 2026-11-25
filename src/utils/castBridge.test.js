import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAST_NAMESPACE,
  normalizeClientRoomCode,
  resolveServerOrigin,
  resolvePublicShareOrigin,
  buildPartyJoinUrl,
  buildCastReceiverUrl,
  parseCastMessage,
} from './castBridge.js';

test('normalizeClientRoomCode cleans uppercase room codes and rejects invalid inputs', () => {
  assert.equal(normalizeClientRoomCode(' ab-7k9m '), 'AB7K9M');
  assert.equal(normalizeClientRoomCode('xy99'), 'XY99');
  assert.equal(normalizeClientRoomCode('123'), '');
  assert.equal(normalizeClientRoomCode(''), '');
  assert.equal(normalizeClientRoomCode(null), '');
});

test('resolveServerOrigin follows query -> Android bridge -> env -> window origin priority', () => {
  assert.equal(
    resolveServerOrigin({
      search: '?server=https://k8s.splendor.example.com/',
      bridgeServerUrl: 'https://bridge.example.com',
      envServerUrl: 'https://env.example.com',
      windowOrigin: 'http://localhost:3000',
    }),
    'https://k8s.splendor.example.com'
  );

  assert.equal(
    resolveServerOrigin({
      search: '',
      bridgeServerUrl: 'https://android-k8s.example.com/',
      envServerUrl: 'https://env.example.com',
      windowOrigin: 'http://localhost:3000',
    }),
    'https://android-k8s.example.com'
  );

  assert.equal(
    resolveServerOrigin({
      search: '',
      bridgeServerUrl: '',
      envServerUrl: 'https://env-k8s.example.com/',
      windowOrigin: 'http://localhost:3000',
    }),
    'https://env-k8s.example.com'
  );

  assert.equal(
    resolveServerOrigin({
      search: '?server=javascript:alert(1)',
      bridgeServerUrl: '',
      envServerUrl: '',
      windowOrigin: 'https://play.splendor.dev',
    }),
    'https://play.splendor.dev'
  );
});

test('buildPartyJoinUrl and buildCastReceiverUrl generate clean HTTPS party and Chromecast links', () => {
  const origin = resolvePublicShareOrigin({
    serverPublicBaseUrl: 'https://splendor.mycluster.io/',
    windowOrigin: 'http://localhost:3000',
  });
  assert.equal(origin, 'https://splendor.mycluster.io');
  assert.equal(
    buildPartyJoinUrl(origin, 'a7k3m9'),
    'https://splendor.mycluster.io/?view=player&room=A7K3M9'
  );
  assert.equal(
    buildCastReceiverUrl(origin, 'a7k3m9'),
    'https://splendor.mycluster.io/?view=tv&room=A7K3M9&cast=1'
  );
});

test('parseCastMessage validates ATTACH_ROOM messages on the Chromecast custom namespace', () => {
  assert.equal(CAST_NAMESPACE, 'urn:x-cast:com.splendor.guild');
  assert.deepEqual(parseCastMessage('{"type":"ATTACH_ROOM","roomCode":"k9m4p2"}'), {
    type: 'ATTACH_ROOM',
    roomCode: 'K9M4P2',
  });
  assert.equal(parseCastMessage('{"type":"ATTACH_ROOM","roomCode":"x"}'), null);
  assert.equal(parseCastMessage('not-json'), null);
  assert.equal(parseCastMessage({ type: 'UNKNOWN' }), null);
});
