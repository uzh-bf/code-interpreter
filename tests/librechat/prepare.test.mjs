import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
    lstat,
    mkdir,
    mkdtemp,
    readFile,
    readlink,
    rm,
    stat,
    symlink,
    writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { prepare } from './prepare.mjs';

const execFileAsync = promisify(execFile);
const PREPARE = fileURLToPath(new URL('./prepare.mjs', import.meta.url));
const GIT_ENV = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_TERMINAL_PROMPT: '0',
    LC_ALL: 'C',
};
const E2E_FILE = 'e2e/playwright.config.deployed.ts';
const E2E_MOCK = 'e2e/playwright.config.mock.ts';

async function git(repo, args) {
    const { stdout } = await execFileAsync('git', args, {
        cwd: repo,
        env: GIT_ENV,
        encoding: 'utf8',
    });
    return stdout;
}

async function initRepo(t) {
    const repo = await mkdtemp(path.join(os.tmpdir(), 'prepare-test-repo-'));
    t.after(() => rm(repo, { recursive: true, force: true }));
    await git(repo, ['init', '-q', '-b', 'main']);
    return repo;
}

async function commit(repo, message) {
    await git(repo, [
        '-c',
        'user.name=Prepare Test',
        '-c',
        'user.email=prepare@example.test',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '-q',
        '-m',
        message,
    ]);
}

async function materialize(t, options) {
    const result = await prepare(options);
    t.after(() => rm(path.dirname(result.fixture), { recursive: true, force: true }));
    return result;
}

async function runCli(args) {
    try {
        const { stdout, stderr } = await execFileAsync(
            process.execPath,
            [PREPARE, ...args],
            { env: GIT_ENV, encoding: 'utf8' },
        );
        return { code: 0, stdout, stderr };
    } catch (error) {
        return {
            code: typeof error.code === 'number' ? error.code : 1,
            stdout: error.stdout ?? '',
            stderr: error.stderr ?? '',
        };
    }
}

async function writePatch(t, text) {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'prepare-test-patch-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const file = path.join(directory, 'overlay.patch');
    await writeFile(file, text);
    return file;
}

function replacePatch(rel, before, after) {
    return [
        `diff --git a/${rel} b/${rel}`,
        `--- a/${rel}`,
        `+++ b/${rel}`,
        '@@ -1 +1 @@',
        `-${before}`,
        `+${after}`,
        '',
    ].join('\n');
}

test('materializes tracked source at the exact commit and leaves the caller checkout untouched', async t => {
    const repo = await initRepo(t);
    await mkdir(path.join(repo, 'e2e', 'setup'), { recursive: true });
    await writeFile(path.join(repo, E2E_FILE), 'tracked\n');
    await writeFile(path.join(repo, 'e2e', 'setup', 'keep.txt'), 'keep\n');
    await git(repo, ['add', '-A']);
    await commit(repo, 'seed');
    const head = (await git(repo, ['rev-parse', 'HEAD'])).trim();

    await writeFile(path.join(repo, '.env'), 'TOKEN=test-only\n');
    await writeFile(path.join(repo, 'notes.txt'), 'untracked\n');
    const overlayText = replacePatch(E2E_FILE, 'tracked', 'overlaid');
    const overlay = path.join(repo, 'local-overlay.patch');
    await writeFile(overlay, overlayText);

    const before = await git(repo, ['status', '--porcelain']);
    const result = await materialize(t, { repo, revision: head, patchPath: overlay });

    assert.ok(path.isAbsolute(result.fixture));
    assert.ok(!result.fixture.startsWith(`${repo}${path.sep}`));
    assert.equal(result.revision, head);
    assert.equal(
        result.patchSha256,
        createHash('sha256').update(overlayText).digest('hex'),
    );
    assert.equal(
        await readFile(path.join(result.fixture, E2E_FILE), 'utf8'),
        'overlaid\n',
    );
    assert.equal(
        await readFile(path.join(result.fixture, 'e2e', 'setup', 'keep.txt'), 'utf8'),
        'keep\n',
    );
    await assert.rejects(stat(path.join(result.fixture, '.env')), { code: 'ENOENT' });
    await assert.rejects(stat(path.join(result.fixture, 'notes.txt')), { code: 'ENOENT' });
    await assert.rejects(stat(path.join(result.fixture, 'local-overlay.patch')), {
        code: 'ENOENT',
    });
    await assert.rejects(stat(path.join(result.fixture, '.git')), { code: 'ENOENT' });

    assert.equal((await git(repo, ['rev-parse', 'HEAD'])).trim(), head);
    assert.equal(await git(repo, ['status', '--porcelain']), before);
});

test('pins the requested commit and omits tracked symlinks from the fixture', async t => {
    const repo = await initRepo(t);
    await mkdir(path.join(repo, 'e2e'), { recursive: true });
    await writeFile(path.join(repo, 'version.txt'), 'one\n');
    await writeFile(path.join(repo, E2E_FILE), 'tracked\n');
    await symlink(E2E_FILE, path.join(repo, 'alias'));
    await git(repo, ['add', '-A']);
    await commit(repo, 'one');
    const first = (await git(repo, ['rev-parse', 'HEAD'])).trim();

    await writeFile(path.join(repo, 'version.txt'), 'two\n');
    await git(repo, ['add', '-A']);
    await commit(repo, 'two');
    const second = (await git(repo, ['rev-parse', 'HEAD'])).trim();
    assert.notEqual(first, second);

    const overlay = await writePatch(
        t,
        replacePatch(E2E_FILE, 'tracked', 'overlaid'),
    );
    const result = await materialize(t, { repo, revision: first, patchPath: overlay });
    assert.equal(
        await readFile(path.join(result.fixture, 'version.txt'), 'utf8'),
        'one\n',
    );
    assert.equal(
        await readFile(path.join(result.fixture, E2E_FILE), 'utf8'),
        'overlaid\n',
    );
    await assert.rejects(stat(path.join(result.fixture, 'alias')), { code: 'ENOENT' });
    assert.equal(await readlink(path.join(repo, 'alias')), E2E_FILE);
    assert.equal(await readFile(path.join(repo, 'version.txt'), 'utf8'), 'two\n');
    assert.equal((await git(repo, ['rev-parse', 'HEAD'])).trim(), second);

    for (const revision of [
        'main',
        first.slice(0, 12),
        first.toUpperCase(),
        '0'.repeat(40),
    ]) {
        await assert.rejects(prepare({ repo, revision, patchPath: overlay }));
    }
});

test('rejects malformed flags and non-repository paths without stdout', async t => {
    const repo = await initRepo(t);
    const nested = path.join(repo, 'nested');
    await mkdir(nested);
    const plain = await mkdtemp(path.join(os.tmpdir(), 'prepare-test-plain-'));
    t.after(() => rm(plain, { recursive: true, force: true }));
    const missing = '0'.repeat(40);

    const cases = [
        [],
        ['--repo', repo],
        ['--repo', 'relative/repo', '--revision', missing],
        ['--repo', plain, '--revision', missing],
        ['--repo', nested, '--revision', missing],
        ['--repo', repo, '--revision', missing, '--extra', 'value'],
        ['--repo', repo, '--repo', repo, '--revision', missing],
    ];
    for (const args of cases) {
        const result = await runCli(args);
        assert.notEqual(result.code, 0, args.join(' '));
        assert.equal(result.stdout, '', args.join(' '));
        assert.match(result.stderr, /^prepare: /);
    }
});

test('rejects unsafe overlay paths and omits escaping source symlinks', async t => {
    const repo = await initRepo(t);
    await mkdir(path.join(repo, 'e2e'), { recursive: true });
    await writeFile(path.join(repo, E2E_FILE), 'tracked\n');
    await symlink(E2E_FILE, path.join(repo, 'alias'));
    await symlink('playwright.config.deployed.ts', path.join(repo, E2E_MOCK));
    await symlink('../../outside', path.join(repo, 'escape-link'));
    await git(repo, ['add', '-A']);
    await commit(repo, 'seed');
    const head = (await git(repo, ['rev-parse', 'HEAD'])).trim();
    const before = await git(repo, ['status', '--porcelain']);

    const traversal = await writePatch(
        t,
        [
            'diff --git a/../escaped.txt b/../escaped.txt',
            'new file mode 100644',
            '--- /dev/null',
            '+++ b/../escaped.txt',
            '@@ -0,0 +1 @@',
            '+TOP-SECRET-MARKER',
            '',
        ].join('\n'),
    );
    await assert.rejects(prepare({ repo, revision: head, patchPath: traversal }), error => {
        assert.ok(error instanceof Error);
        assert.ok(!error.message.includes('TOP-SECRET-MARKER'));
        return true;
    });
    await assert.rejects(stat(path.join(path.dirname(repo), 'escaped.txt')), {
        code: 'ENOENT',
    });

    const gitPath = await writePatch(
        t,
        [
            'diff --git a/.git/config b/.git/config',
            'new file mode 100644',
            '--- /dev/null',
            '+++ b/.git/config',
            '@@ -0,0 +1 @@',
            '+unsafe',
            '',
        ].join('\n'),
    );
    await assert.rejects(prepare({ repo, revision: head, patchPath: gitPath }));

    const replaceSymlink = await writePatch(
        t,
        replacePatch(E2E_MOCK, 'tracked', 'replaced'),
    );
    await assert.rejects(
        prepare({ repo, revision: head, patchPath: replaceSymlink }),
        /symlink/,
    );
    const alias = await lstat(path.join(repo, 'alias'));
    assert.ok(alias.isSymbolicLink());
    assert.equal(await readlink(path.join(repo, 'alias')), E2E_FILE);

    const valid = await writePatch(
        t,
        replacePatch(E2E_FILE, 'tracked', 'overlaid'),
    );
    const result = await materialize(t, { repo, revision: head, patchPath: valid });
    assert.equal(
        await readFile(path.join(result.fixture, E2E_FILE), 'utf8'),
        'overlaid\n',
    );
    await assert.rejects(stat(path.join(result.fixture, 'alias')), { code: 'ENOENT' });
    await assert.rejects(stat(path.join(result.fixture, 'escape-link')), {
        code: 'ENOENT',
    });
    assert.equal(await readlink(path.join(repo, 'escape-link')), '../../outside');

    assert.equal((await git(repo, ['rev-parse', 'HEAD'])).trim(), head);
    assert.equal(await git(repo, ['status', '--porcelain']), before);
});
