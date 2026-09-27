import { assertEquals } from 'jsr:@std/assert@1';
import { detectLang } from './detect.ts';

Deno.test('detectLang', () => {
  assertEquals(detectLang('こんにちは！週末は何してた？'), 'ja');
  assertEquals(detectLang('안녕하세요, 주말에 뭐 했어요?'), 'ko');
  assertEquals(detectLang('Hello there'), 'en');
  assertEquals(detectLang('東京'), 'ja');
  assertEquals(detectLang('12345 🙂'), 'und');
  assertEquals(detectLang('ありがとう 감사합니다 감사'), 'ko');
});
