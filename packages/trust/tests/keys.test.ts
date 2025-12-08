import { describe, expect, test } from "bun:test";
import { generateKeyPair, getKeyTypeFromPEM, isValidPEMKey } from "../src/keys";

describe("key management utilities", () => {
  describe("generateKeyPair", () => {
    test("generates RSA key pair", () => {
      const keyPair = generateKeyPair({
        type: "rsa",
        modulusLength: 2048,
      });

      expect(keyPair.type).toBe("rsa");
      expect(keyPair.format).toBe("pem");
      expect(keyPair.publicKey).toContain("-----BEGIN PUBLIC KEY-----");
      expect(keyPair.publicKey).toContain("-----END PUBLIC KEY-----");
      expect(keyPair.privateKey).toContain("-----BEGIN PRIVATE KEY-----");
      expect(keyPair.privateKey).toContain("-----END PRIVATE KEY-----");
    });

    test("generates Ed25519 key pair", () => {
      const keyPair = generateKeyPair({
        type: "ed25519",
      });

      expect(keyPair.type).toBe("ed25519");
      expect(keyPair.format).toBe("pem");
      expect(keyPair.publicKey).toContain("-----BEGIN PUBLIC KEY-----");
      expect(keyPair.privateKey).toContain("-----BEGIN PRIVATE KEY-----");
    });

    test("generates ECDSA key pair", () => {
      const keyPair = generateKeyPair({
        type: "ecdsa",
      });

      expect(keyPair.type).toBe("ecdsa");
      expect(keyPair.format).toBe("pem");
      expect(keyPair.publicKey).toContain("-----BEGIN PUBLIC KEY-----");
      expect(keyPair.privateKey).toContain("-----BEGIN PRIVATE KEY-----");
    });

    test("generates encrypted RSA key pair with passphrase", () => {
      const keyPair = generateKeyPair({
        type: "rsa",
        modulusLength: 2048,
        passphrase: "secret123",
      });

      expect(keyPair.privateKey).toContain("-----BEGIN ENCRYPTED PRIVATE KEY-----");
      expect(keyPair.privateKey).toContain("-----END ENCRYPTED PRIVATE KEY-----");
    });

    test("generates different key pairs on each call", () => {
      const keyPair1 = generateKeyPair({ type: "ed25519" });
      const keyPair2 = generateKeyPair({ type: "ed25519" });

      expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
    });

    test("supports custom RSA modulus length", () => {
      const keyPair4096 = generateKeyPair({
        type: "rsa",
        modulusLength: 4096,
      });

      // 4096-bit keys should be longer than 2048-bit keys
      const keyPair2048 = generateKeyPair({
        type: "rsa",
        modulusLength: 2048,
      });

      expect(keyPair4096.privateKey.length).toBeGreaterThan(keyPair2048.privateKey.length);
    });
  });

  describe("isValidPEMKey", () => {
    test("validates public key PEM format", () => {
      const keyPair = generateKeyPair({ type: "ed25519" });

      expect(isValidPEMKey(keyPair.publicKey, "public")).toBe(true);
    });

    test("validates private key PEM format", () => {
      const keyPair = generateKeyPair({ type: "ed25519" });

      expect(isValidPEMKey(keyPair.privateKey, "private")).toBe(true);
    });

    test("validates encrypted private key PEM format", () => {
      const keyPair = generateKeyPair({
        type: "rsa",
        passphrase: "secret",
      });

      expect(isValidPEMKey(keyPair.privateKey, "private")).toBe(true);
    });

    test("rejects invalid PEM format", () => {
      expect(isValidPEMKey("not a valid key", "private")).toBe(false);
      expect(isValidPEMKey("", "public")).toBe(false);
    });

    test("rejects public key when expecting private", () => {
      const keyPair = generateKeyPair({ type: "ed25519" });

      expect(isValidPEMKey(keyPair.publicKey, "private")).toBe(false);
    });

    test("rejects private key when expecting public", () => {
      const keyPair = generateKeyPair({ type: "ed25519" });

      expect(isValidPEMKey(keyPair.privateKey, "public")).toBe(false);
    });
  });

  describe("getKeyTypeFromPEM", () => {
    test("detects RSA key type", () => {
      const keyPair = generateKeyPair({
        type: "rsa",
        modulusLength: 2048,
      });

      const detectedType = getKeyTypeFromPEM(keyPair.privateKey);
      expect(detectedType).toBe("rsa");
    });

    test("detects Ed25519 key type", () => {
      const keyPair = generateKeyPair({ type: "ed25519" });

      const detectedType = getKeyTypeFromPEM(keyPair.privateKey);
      expect(detectedType).toBe("ed25519");
    });

    test("detects ECDSA key type", () => {
      const keyPair = generateKeyPair({ type: "ecdsa" });

      const detectedType = getKeyTypeFromPEM(keyPair.privateKey);
      expect(detectedType).toBe("ecdsa");
    });

    test("returns undefined for invalid PEM", () => {
      const detectedType = getKeyTypeFromPEM("not a key");
      expect(detectedType).toBeUndefined();
    });
  });
});
