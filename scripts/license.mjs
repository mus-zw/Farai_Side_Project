#!/usr/bin/env node
/**
 * Issue offline-verifiable license keys (see src/utils/entitlements.ts).
 *
 *   node scripts/license.mjs keygen --out ~/secrets/farai-license
 *       Writes license-private.jwk.json and license-public.jwk.json, and prints the
 *       VITE_LICENSE_PUBLIC_KEY line to put in your Cloudflare Pages environment.
 *       KEEP THE PRIVATE KEY OUT OF THIS REPO. Anyone who has it can mint keys.
 *
 *   node scripts/license.mjs sign --private ~/secrets/farai-license/license-private.jwk.json \
 *        --product cv-pro --id "acme-labs" --days 365
 *       Prints a key like FARAI1.<payload>.<signature> to send to the customer.
 *
 * Products: cv-pro, fitness-solo_year, fitness-solo_12week, fitness-pilot.
 * Keys are checked in the browser, so they can be copied and cannot be revoked;
 * use short expiries for anything you may need to take back.
 */
import { webcrypto as crypto } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PRODUCTS = ['cv-pro', 'fitness-solo_year', 'fitness-solo_12week', 'fitness-pilot'];
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const args = process.argv.slice(2);
const cmd = args.shift();
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const die = (msg) => {
  console.error(msg);
  process.exit(1);
};

if (cmd === 'keygen') {
  const out = opt('out') ?? '.';
  const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  fs.mkdirSync(out, { recursive: true });
  const privPath = path.join(out, 'license-private.jwk.json');
  const pubJwk = await crypto.subtle.exportKey('jwk', publicKey);
  fs.writeFileSync(privPath, JSON.stringify(await crypto.subtle.exportKey('jwk', privateKey)), { mode: 0o600 });
  fs.writeFileSync(path.join(out, 'license-public.jwk.json'), JSON.stringify(pubJwk));
  console.log(`Private key: ${privPath}  (keep it secret, outside this repo)`);
  console.log('\nAdd this to your build environment:\n');
  console.log(`VITE_LICENSE_PUBLIC_KEY='${JSON.stringify(pubJwk)}'`);
} else if (cmd === 'sign') {
  const privFile = opt('private');
  const product = opt('product');
  const id = opt('id') ?? 'customer';
  const days = opt('days') ? Number(opt('days')) : undefined;
  if (!privFile || !fs.existsSync(privFile)) die('Pass --private <path to license-private.jwk.json>.');
  if (!PRODUCTS.includes(product)) die(`--product must be one of: ${PRODUCTS.join(', ')}`);
  if (days !== undefined && !(days > 0)) die('--days must be a positive number.');
  const priv = await crypto.subtle.importKey('jwk', JSON.parse(fs.readFileSync(privFile, 'utf8')), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ p: product, id, iat: now, ...(days ? { exp: now + Math.round(days * 86400) } : {}) }));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, payload);
  console.log(`FARAI1.${b64url(payload)}.${b64url(new Uint8Array(sig))}`);
} else {
  die('Usage: node scripts/license.mjs keygen --out <dir>  |  sign --private <file> --product <p> --id <label> [--days N]');
}
