#!/usr/bin/env node
// Materialize tracked LibreChat source at one exact commit into a disposable
// fixture and apply the reviewed consumer E2E overlay there. The caller's
// checkout is read-only input. Only regular tracked blobs are written; tracked
// symlinks are omitted so extraction cannot escape the fixture, and untracked
// files, credentials, dependencies and tests are never copied or started.
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
    lstat,
    mkdir,
    mkdtemp,
    readFile,
    realpath,
    rm,
    stat,
    writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATCH = path.join(HERE, 'consumer-e2e.patch');
const FULL_SHA = /^[0-9a-f]{40}$/;
const E2E_PATHS = new Set([
    'e2e/playwright.config.deployed.ts',
    'e2e/playwright.config.mock.ts',
    'e2e/setup/codeapi-cancellation-receipts.cjs',
    'e2e/setup/codeapi-cancellation-receipts.test.cjs',
    'e2e/setup/codeapi-response-observer.cjs',
    'e2e/setup/codeapi-response-observer.test.cjs',
    'e2e/setup/fake-model.js',
    'e2e/specs/deployed/codeapi.spec.ts',
    'e2e/specs/mock/code-upload.spec.ts',
]);
const execFileAsync = promisify(execFile);

class PrepareError extends Error {}

const fail = reason => {
    throw new PrepareError(reason);
};

function baseEnv() {
    return {
        PATH: process.env.PATH ?? '/usr/bin:/bin:/usr/sbin:/sbin',
        LC_ALL: 'C',
    };
}

function gitEnv(ceiling) {
    const env = {
        ...baseEnv(),
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: os.devNull,
        GIT_TERMINAL_PROMPT: '0',
    };
    if (ceiling) {
        env.GIT_CEILING_DIRECTORIES = ceiling;
    }
    return env;
}

async function git(args, { ceiling } = {}, reason) {
    try {
        const { stdout } = await execFileAsync('git', args, {
            env: gitEnv(ceiling),
            encoding: 'utf8',
            maxBuffer: 32 * 1024 * 1024,
        });
        return stdout;
    } catch {
        fail(reason);
    }
}

async function resolveRepo(repo) {
    if (typeof repo !== 'string' || !path.isAbsolute(repo)) {
        fail('--repo must be an absolute path');
    }
    let info;
    try {
        info = await stat(repo);
    } catch {
        fail('--repo is not an existing directory');
    }
    if (!info.isDirectory()) {
        fail('--repo is not an existing directory');
    }
    let root;
    try {
        root = await realpath(repo);
    } catch {
        fail('--repo could not be resolved');
    }
    const ceiling = path.dirname(root);
    const top = (
        await git(
            ['-C', repo, 'rev-parse', '--show-toplevel'],
            { ceiling },
            '--repo is not a Git work tree',
        )
    ).trim();
    let topRoot;
    try {
        topRoot = await realpath(top);
    } catch {
        fail('--repo work tree could not be resolved');
    }
    if (topRoot !== root) {
        fail('--repo must be the work-tree root');
    }
    return root;
}

async function resolveRevision(repo, revision, ceiling) {
    if (typeof revision !== 'string' || !FULL_SHA.test(revision)) {
        fail('--revision must be a full 40-character lowercase commit id');
    }
    const resolved = (
        await git(
            [
                '-C',
                repo,
                'rev-parse',
                '--verify',
                '--end-of-options',
                `${revision}^{commit}`,
            ],
            { ceiling },
            '--revision does not name a commit',
        )
    ).trim();
    if (resolved !== revision) {
        fail('--revision does not name a commit');
    }
    return resolved;
}

function assertRelativePath(rel, reason) {
    const parts = typeof rel === 'string' ? rel.split('/') : [];
    if (
        parts.length === 0 ||
        rel === '' ||
        rel.includes('\0') ||
        rel.startsWith('/') ||
        parts.some(part => part === '' || part === '.' || part === '..') ||
        parts[0] === '.git'
    ) {
        fail(reason);
    }
    return rel;
}

function patchPath(raw, side) {
    if (raw === '/dev/null') {
        return null;
    }
    if (!raw.startsWith(`${side}/`) || /[\s"]/.test(raw)) {
        fail('overlay patch has an unsupported path');
    }
    return assertRelativePath(
        raw.slice(side.length + 1),
        'overlay patch has an unsafe path',
    );
}

function parsePatch(bytes) {
    if (bytes.includes(0)) {
        fail('overlay patch contains binary data');
    }
    const targets = new Set();
    let current = null;
    let diffs = 0;

    for (const line of bytes.toString('utf8').split('\n')) {
        if (line.startsWith('diff --git ')) {
            diffs += 1;
            const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
            if (!match) {
                fail('overlay patch has an unsupported diff header');
            }
            const from = patchPath(`a/${match[1]}`, 'a');
            const to = patchPath(`b/${match[2]}`, 'b');
            if (!from || !to || from !== to) {
                fail('overlay patch renames paths');
            }
            if (!E2E_PATHS.has(to)) {
                fail('overlay patch touches a path outside the consumer E2E set');
            }
            current = to;
            targets.add(to);
            continue;
        }
        if (line.startsWith('--- ') || line.startsWith('+++ ')) {
            if (!current) {
                fail('overlay patch is not a git patch');
            }
            const side = line.startsWith('--- ') ? 'a' : 'b';
            const rel = patchPath(line.slice(4), side);
            if (rel && rel !== current) {
                fail('overlay patch has inconsistent paths');
            }
            continue;
        }
        if (line.startsWith('new file mode ') || line.startsWith('deleted file mode ')) {
            if (!current) {
                fail('overlay patch is not a git patch');
            }
            const mode = line.slice(line.lastIndexOf(' ') + 1);
            if (!/^[0-7]{6}$/.test(mode) || (parseInt(mode, 8) & 0o170000) === 0o120000) {
                fail('overlay patch has an unsupported file mode');
            }
            continue;
        }
        if (
            line.startsWith('old mode ') ||
            line.startsWith('new mode ') ||
            line.startsWith('rename ') ||
            line.startsWith('copy ') ||
            line.startsWith('Binary files ') ||
            line === 'GIT binary patch'
        ) {
            fail('overlay patch has an unsupported change');
        }
    }
    if (diffs === 0) {
        fail('overlay patch is empty');
    }
    return targets;
}

async function readPatch(patchPath) {
    if (typeof patchPath !== 'string' || !path.isAbsolute(patchPath)) {
        fail('overlay patch path must be absolute');
    }
    let bytes;
    try {
        bytes = await readFile(patchPath);
    } catch {
        fail('overlay patch could not be read');
    }
    return {
        bytes,
        targets: parsePatch(bytes),
        sha256: createHash('sha256').update(bytes).digest('hex'),
    };
}

async function listTree(repo, revision, ceiling) {
    const listing = await git(
        ['-C', repo, 'ls-tree', '-r', '-z', '--full-tree', revision],
        { ceiling },
        'source tree could not be listed',
    );
    const folded = new Set();
    const symlinks = new Set();
    for (const record of listing.split('\0')) {
        if (!record) {
            continue;
        }
        const tab = record.indexOf('\t');
        if (tab === -1) {
            fail('source tree listing is malformed');
        }
        const meta = record.slice(0, tab).split(' ');
        if (meta.length !== 3) {
            fail('source tree listing is malformed');
        }
        const [mode, type] = meta;
        const rel = assertRelativePath(
            record.slice(tab + 1),
            'source tree path is unsafe',
        );
        if (folded.has(rel.toLowerCase())) {
            fail('source tree has colliding paths');
        }
        folded.add(rel.toLowerCase());
        if (mode === '120000' && type === 'blob') {
            symlinks.add(rel);
            continue;
        }
        if (!['100644', '100755'].includes(mode) || type !== 'blob') {
            fail('source tree contains an unsupported entry');
        }
    }
    return symlinks;
}

async function materializeTree(repo, revision, ceiling, staging, fixture, overlay) {
    const symlinks = await listTree(repo, revision, ceiling);
    for (const rel of overlay.targets) {
        if (symlinks.has(rel)) {
            fail('overlay patch targets a source symlink');
        }
    }
    const archive = path.join(staging, 'source.tar');
    await git(
        [
            '-C',
            repo,
            'archive',
            '--format=tar',
            `--output=${archive}`,
            revision,
        ],
        { ceiling },
        'source archive could not be created',
    );
    try {
        await execFileAsync('tar', ['-x', '-f', archive, '-C', fixture], {
            env: baseEnv(),
            encoding: 'utf8',
            maxBuffer: 8 * 1024 * 1024,
        });
    } catch {
        fail('source archive could not be extracted');
    }
    await rm(archive, { force: true }).catch(() => {});
    for (const rel of symlinks) {
        const destination = path.resolve(fixture, rel);
        const info = await lstat(destination);
        if (!info.isSymbolicLink()) {
            fail('source symlink did not materialize as expected');
        }
        await rm(destination, { force: true });
    }
}

async function applyPatch(fixture, patchCopy) {
    await git(
        ['-C', fixture, 'apply', '--check', '--whitespace=nowarn', patchCopy],
        { ceiling: fixture },
        'overlay patch does not apply cleanly',
    );
    await git(
        ['-C', fixture, 'apply', '--whitespace=nowarn', patchCopy],
        { ceiling: fixture },
        'overlay patch could not be applied',
    );
}

export async function prepare({ repo, revision, patchPath = DEFAULT_PATCH } = {}) {
    const root = await resolveRepo(repo);
    const ceiling = path.dirname(root);
    const commit = await resolveRevision(repo, revision, ceiling);
    const overlay = await readPatch(patchPath);

    let staging;
    try {
        staging = await mkdtemp(path.join(os.tmpdir(), 'codeapi-consumer-e2e-'));
    } catch {
        fail('temporary fixture directory could not be created');
    }
    try {
        const fixture = path.join(staging, 'fixture');
        await mkdir(fixture, { mode: 0o700 });
        const patchCopy = path.join(staging, 'overlay.patch');
        await writeFile(patchCopy, overlay.bytes, { flag: 'wx', mode: 0o600 });
        await materializeTree(repo, commit, ceiling, staging, fixture, overlay);
        await applyPatch(fixture, patchCopy);
        return { fixture, revision: commit, patchSha256: overlay.sha256 };
    } catch (error) {
        await rm(staging, { recursive: true, force: true }).catch(() => {});
        if (error instanceof PrepareError) {
            throw error;
        }
        throw new PrepareError('fixture preparation failed');
    }
}

function parseArgs(argv) {
    const values = {};
    for (let index = 0; index < argv.length; index += 1) {
        const match = /^--(repo|revision)(?:=(.*))?$/.exec(argv[index]);
        if (!match || values[match[1]] !== undefined) {
            fail('usage: prepare.mjs --repo <absolute> --revision <40-hex>');
        }
        let value = match[2];
        if (value === undefined) {
            value = argv[index + 1];
            index += 1;
        }
        if (!value || value.startsWith('--')) {
            fail('usage: prepare.mjs --repo <absolute> --revision <40-hex>');
        }
        values[match[1]] = value;
    }
    if (!values.repo || !values.revision) {
        fail('usage: prepare.mjs --repo <absolute> --revision <40-hex>');
    }
    return values;
}

async function main() {
    const { repo, revision } = parseArgs(process.argv.slice(2));
    const result = await prepare({ repo, revision });
    process.stdout.write(`${JSON.stringify(result)}\n`);
}

const invoked = process.argv[1]
    ? pathToFileURL(path.resolve(process.argv[1])).href
    : undefined;
if (invoked === import.meta.url) {
    main().catch(error => {
        process.stderr.write(
            `prepare: ${error instanceof PrepareError ? error.message : 'preparation failed'}\n`,
        );
        process.exitCode = 1;
    });
}
