import test from 'node:test';
import assert from 'node:assert/strict';

import { discoverFieldMap } from '../otop/core/field_map.js';
import {
  buildRecord, mergeRecords, buildCert, parseCertDate, certStatus,
} from '../otop/core/record.js';
import CONFIG from '../otop.config.json' with { type: 'json' };

const prov = (datasetId = 'ds1', resourceId = 'r1') => ({ datasetId, resourceId, retrievedAt: '2026-09-08T00:00:00Z' });
const row = (over = {}) => ({ sourceRowId: 'x#0', producerName: 'กลุ่มทดสอบ', productName: 'ผ้าทอ', province: 'บุรีรัมย์', ...over });

test('parseCertDate reads ISO, BE years and Thai day/month order; refuses garbage', () => {
  assert.equal(parseCertDate('2024-06-21T00:00:00'), '2024-06-21');
  assert.equal(parseCertDate('2027-6-20'), '2027-06-20');
  assert.equal(parseCertDate('2567-06-21'), '2024-06-21');
  assert.equal(parseCertDate('21/06/2567'), '2024-06-21');
  assert.equal(parseCertDate(''), null);
  assert.equal(parseCertDate('-'), null);
  assert.equal(parseCertDate('ไม่มีข้อมูล'), null);
  assert.equal(parseCertDate('not a date'), null);
});

test('buildCert keeps every certificate field and vanishes when there is none', () => {
  assert.deepEqual(
    buildCert({ number: '454-92/623(กบ)', standardCode: 'มผช.623/2547', standardTitle: 'ผลิตภัณฑ์ประดับมุก', issued: '2024-06-21T00:00:00', expires: '2027-06-20T00:00:00' }),
    { number: '454-92/623(กบ)', standardCode: 'มผช.623/2547', standardTitle: 'ผลิตภัณฑ์ประดับมุก', issued: '2024-06-21', expires: '2027-06-20' },
  );
  assert.equal(buildCert({ number: '', standardCode: '', standardTitle: '', issued: '', expires: '' }), null);
  assert.equal(buildCert({ number: '-', standardCode: null, standardTitle: null, issued: null, expires: null }), null);
});

test('buildRecord carries the certificate; a plain row carries an empty set', () => {
  const cert = buildRecord(row({ certNumber: '1/2566', certStandardCode: 'มผช.1/2546', certExpires: '2027-01-01' }), prov());
  assert.equal(cert.certs.length, 1);
  assert.equal(cert.certs[0].number, '1/2566');
  assert.deepEqual(buildRecord(row(), prov()).certs, []);
});

test('certStatus judges valid / expired / unknown against the build date, never today', () => {
  const asOf = '2026-09-11';
  assert.equal(certStatus([], asOf), null);
  assert.equal(certStatus([{ expires: '2027-06-20' }], asOf), 'valid');
  assert.equal(certStatus([{ expires: '2026-09-11' }], asOf), 'valid');
  assert.equal(certStatus([{ expires: '2024-01-01' }], asOf), 'expired');
  assert.equal(certStatus([{ number: 'x' }], asOf), 'unknown');
  assert.equal(certStatus([{ expires: '2027-01-01' }], 'not-a-date'), 'unknown');
  // One live certificate keeps the record valid even beside a lapsed one.
  assert.equal(certStatus([{ expires: '2024-01-01' }, { expires: '2027-01-01' }], asOf), 'valid');
  // Same inputs, same output regardless of when the test runs.
  assert.equal(certStatus([{ expires: '2027-06-20' }], '2028-01-01'), 'expired');
});

test('merge unions certificates and counts one snapshot filing once', () => {
  const a = buildRecord(row({ producerName: 'กลุ่มไข่มุก', phone: '0812345678', certNumber: '454/623', certStandardCode: 'มผช.623/2547', certExpires: '2027-06-20' }), prov('ds1', 'r1'));
  const b = buildRecord(row({ producerName: 'กลุ่มไข่มุก', phone: '0812345678', certNumber: '454/623', certStandardCode: 'มผช.623/2547', certExpires: '2027-06-20' }), prov('ds1', 'r2'));
  const c = buildRecord(row({ producerName: 'กลุ่มไข่มุก', phone: '0812345678', certNumber: '999/700', certStandardCode: 'มผช.700/2550', certExpires: '2028-01-01' }), prov('ds2', 'r3'));
  const [merged] = mergeRecords([a, b, c]);
  assert.equal(merged.mergedFrom, 3);
  assert.equal(merged.certs.length, 2);
  assert.deepEqual(merged.certs.map((x) => x.number).sort(), ['454/623', '999/700']);
});

test('a certificate is provenance, never identity: shared cert alone merges nothing', () => {
  const a = buildRecord(row({ producerName: 'กลุ่มหนึ่ง', province: 'บุรีรัมย์', certNumber: 'SAME' }), prov('ds1', 'r1'));
  const b = buildRecord(row({ producerName: 'กลุ่มสอง', province: 'เชียงใหม่', certNumber: 'SAME' }), prov('ds1', 'r2'));
  assert.equal(mergeRecords([a, b]).length, 2);
});

test('field discovery maps the มผช. holder columns without touching the street number', () => {
  const headers = ['_id', 'ลำดับ', 'เลขที่ใบรับรอง', 'ชื่อ', 'เลขที่', 'หมู่ที่', 'ซอย', 'ถนน', 'ตำบล', 'อำเภอ', 'จังหวัด', 'รหัสไปรษณีย์', 'เลขที่ มผช.', 'ชื่อ มผช.', 'รายละเอียดผลิตภัณฑ์', 'กลุ่มผลิตภัณฑ์', 'วันที่ออกใบรับรอง', 'ใบรับรองหมดอายุ'];
  const { map } = discoverFieldMap(headers, CONFIG.fieldAliases);
  assert.equal(map.producerName, 'ชื่อ');
  assert.equal(map.certNumber, 'เลขที่ใบรับรอง');
  assert.equal(map.certStandardCode, 'เลขที่ มผช.');
  assert.equal(map.certStandardTitle, 'ชื่อ มผช.');
  assert.equal(map.certIssued, 'วันที่ออกใบรับรอง');
  assert.equal(map.certExpires, 'ใบรับรองหมดอายุ');
  // The street number must stay unclaimed: it is an address, not a certificate.
  assert.notEqual(map.certNumber, 'เลขที่');
  assert.ok(!Object.values(map).includes('เลขที่'));
});
