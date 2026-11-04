import asyncio, tempfile, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server
from aiohttp.test_utils import TestServer, TestClient

async def main():
    td = Path(tempfile.mkdtemp())
    server.DATA_DIR = td
    server.CONFIG_FILE = td/'config.json'
    server.USERS_FILE = td/'users.json'
    server.ROOMS_FILE = td/'rooms.json'
    server.LOGINS_FILE = td/'logins.json'
    server.users.clear(); server.logins.clear(); server.rooms.clear(); server.admin_tokens.clear(); server.user_sessions.clear()
    server.config['admin_password_hash'] = server.hash_password('SmokeTestAdminPassword!2026')
    server.config['email_login_enabled'] = False
    app = server.create_app()
    client = TestClient(TestServer(app)); await client.start_server()
    try:
        r = await client.get('/api/admin/config'); assert r.status == 401, r.status
        r = await client.get('/ktv/api/admin/config'); assert r.status == 401, r.status
        r = await client.get('/ktv/api/config'); assert r.status == 200
        r = await client.get('/ktv/'); assert r.status == 200
        assert (await client.get('/ktv/sw.js')).status == 200
        assert (await client.get('/ktv/manifest.webmanifest')).status == 200
        assert (await client.get('/ktv/icons/icon-192.png')).status == 200
        r = await client.post('/api/admin/login', json={'password':'wrong'}); assert r.status == 401
        r = await client.post('/api/admin/login', json={'password':'SmokeTestAdminPassword!2026'}); assert r.status == 200
        token = (await r.json())['token']
        r = await client.get('/api/admin/config', headers={'Authorization':'Bearer '+token}); assert r.status == 200
        assert 'admin_password_hash' not in await r.json()
        r = await client.post('/api/ktvs', json={}); assert r.status == 200
        room = await r.json(); code=room['code']; host_token=room['host_token']
        assert 'owner_token_hash' not in room['ktv']
        qr_response = await client.post(f'/ktv/api/qr/{code}', json={'remote_token': host_token})
        qr_payload = await qr_response.json()
        assert qr_response.status == 200 and qr_payload['qr'].startswith('data:image/png;base64,')
        assert 'host_token=' in qr_payload['url']
        guest = await client.ws_connect('/ktv/ws')
        await guest.send_json({'type':'join','code':code,'requester':'guest'})
        await guest.receive_json()
        await guest.send_json({'type':'pause'})
        denied = await guest.receive_json(); assert denied['type']=='error' and 'Host permission' in denied['error']
        host = await client.ws_connect('/ktv/ws')
        await host.send_json({'type':'join','code':code,'host_token':host_token,'requester':'host'})
        await host.receive_json()
        await host.send_json({'type':'pause'})
        # host receives room state broadcast after accepted command
        accepted = await host.receive_json(); assert accepted['type']=='ktv'
        await guest.close(); await host.close()
        r = await client.post('/api/login', json={'email':'test@example.com','password':'CorrectHorseBattery9'})
        assert r.status == 200
        user_token=(await r.json())['token']
        server.config['email_login_enabled'] = True
        denied_create = await client.post('/api/ktvs', json={}); assert denied_create.status == 401
        allowed_create = await client.post('/ktv/api/ktvs', json={}, headers={'Authorization':'Bearer '+user_token}); assert allowed_create.status == 200
        r = await client.post('/api/login', json={'email':'test@example.com','password':'badpassword'})
        assert r.status == 401
        server.load_persisted_data()
        assert code in server.rooms and server.rooms[code]['guestCount'] == 0
        print('PASS: admin authorization, password auth, prefixed API/static paths, PWA assets, local QR generation, room persistence, host/guest WebSocket permissions')
    finally:
        await client.close()

asyncio.run(main())
