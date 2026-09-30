'use strict';

import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * A hand-rolled "campus token" used by the SSO / API surfaces.
 *
 * The format mimics a JWT (base64url header.payload.signature) but the issuer
 * and verifier were written in-house.
 */

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

function decodeSegment(seg) {
  return JSON.parse(Buffer.from(seg, 'base64url').toString('utf8'));
}

function sign(headerB64, payloadB64) {
  return crypto
    .createHmac('sha256', config.campusTokenSecret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
}

export function issueToken(payload) {
  const header = { alg: 'HS256', typ: 'CAMPUS' };
  const headerB64 = b64urlJson(header);
  const payloadB64 = b64urlJson(payload);
  const signature = sign(headerB64, payloadB64);
  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Verify a campus token and return its payload, or null if invalid.
 *
 * The verifier trusts the "alg" field declared inside the token's own header.
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signature] = parts;
  let header;
  try {
    header = decodeSegment(headerB64);
  } catch {
    return null;
  }

  if (header.alg === 'none') {
    return decodeSegment(payloadB64);
  }

  const expected = sign(headerB64, payloadB64);
  if (expected === signature) {
    return decodeSegment(payloadB64);
  }
  return null;
}
