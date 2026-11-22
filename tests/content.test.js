// The live content (public/data.json) is edited by hand on GitHub and the deploy
// runs these tests: only its *structure* is checked here, never its content.
import { describe, it, expect } from 'vitest';
import live from '../public/data.json';
import fixture from './fixtures/data.json';
import { validateData } from '../src/data.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

describe('validateData', () => {
  it('accepts the live public/data.json', () => {
    expect(validateData(live)).toEqual([]);
  });

  it('accepts content edits (new phone, new person, new bloc)', () => {
    const d = clone(fixture);
    d.stands[3].people[1].phone = '22 123 456';
    d.stands[1].people.push({ name: 'Nouveau', phone: '+216 98 765 432' });
    d.stands.push({ bloc: 'Bloc K', stand: true, people: [] });
    expect(validateData(d)).toEqual([]);
  });

  it('reports structural mistakes with a readable message', () => {
    const bad = (mutate) => { const d = clone(fixture); mutate(d); return validateData(d); };
    expect(bad((d) => { d.stands = {}; })).toContain('"stands" must be a list [ … ]');
    expect(bad((d) => { d.stands[2].bloc = 5; })).toContain('stand #3: "bloc" must be text');
    expect(bad((d) => { d.stands[2].people = {}; })).toContain('stand #3 (Bloc ESB): "people" must be a list [ … ]');
    expect(bad((d) => { d.stands[3].people[0].name = null; })).toContain('stand #4 (Bloc H), person #1: "name" must be text');
    expect(bad((d) => { d.contact.phones = '95195235'; })).toContain('contact: "phones" must be a list [ … ]');
    expect(bad((d) => { d.contact.email = 'not an email'; })).toContain('contact: "email" is not a valid address');
    expect(bad((d) => { d.contact.instagramEvent = 'http://x.com'; })).toContain('contact: "instagramEvent" must start with https://');
    expect(bad((d) => { d.event.mapUrl = 'javascript:alert(1)'; })).toContain('event: "mapUrl" must start with https://');
    expect(bad((d) => { d.stands[0].stand = 'yes'; })).toContain('stand #1 (Bloc A): "stand" must be true or false');
    expect(validateData(null)).toContain('the file must contain { … }');
  });

  it('accepts a phone typed as a number', () => {
    const d = clone(fixture);
    d.stands[3].people[1].phone = 22123456;
    expect(validateData(d)).toEqual([]);
  });
});
