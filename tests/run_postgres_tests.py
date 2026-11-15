"""Run both inventory implementations on a disposable local PostgreSQL server.

Install test-only dependency pgserver first. No hosted database or Stripe API
is contacted. Server startup and the tests share one process/network namespace.
"""
import getpass
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time

import pgserver
import psycopg


def main():
    binaries = Path(pgserver.__file__).parent / 'pginstall' / 'bin'
    with tempfile.TemporaryDirectory(prefix='tpf-postgres-') as folder:
        data = Path(folder) / 'data'
        subprocess.run([str(binaries / 'initdb'), '-D', str(data), '-A', 'trust',
                        '--no-locale', '--encoding=UTF8'], check=True, capture_output=True)
        with socket.socket(socket.AF_INET) as listener:
            listener.bind(('127.0.0.1', 0))
            port = listener.getsockname()[1]
        with (data / 'postgresql.conf').open('a') as config:
            config.write("\nunix_socket_directories = ''\nlisten_addresses = '127.0.0.1'\n")
        with (Path(folder) / 'server.log').open('w+') as log:
            server = subprocess.Popen([str(binaries / 'postgres'), '-D', str(data), '-p', str(port)],
                                      stdout=log, stderr=log)
            url = f'postgresql://{getpass.getuser()}@127.0.0.1:{port}/postgres'
            try:
                for attempt in range(50):
                    try:
                        with psycopg.connect(url, connect_timeout=1) as db:
                            db.execute('SELECT 1')
                        break
                    except psycopg.OperationalError:
                        if server.poll() is not None:
                            log.seek(0)
                            raise RuntimeError(log.read())
                        time.sleep(.1)
                else:
                    raise RuntimeError('Local PostgreSQL did not become ready')
                return subprocess.run([sys.executable, '-m', 'unittest', 'discover', '-s', 'tests',
                                       '-p', 'test_*.py'],
                                      env={**os.environ, 'TPF_TEST_POSTGRES_URL': url}).returncode
            finally:
                server.terminate()
                server.wait(timeout=10)


if __name__ == '__main__':
    raise SystemExit(main())
