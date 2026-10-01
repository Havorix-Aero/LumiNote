import type { SecurityQuestionPrompt } from './types';

/**
 * The catalog users pick from. Keys are stable and stored in the database, so prompts can be
 * re-worded (or translated) later without invalidating anyone's stored answer.
 */
export const SECURITY_QUESTION_CATALOG: readonly SecurityQuestionPrompt[] = [
  { key: 'first_pet', prompt: '你养的第一只宠物叫什么名字？' },
  { key: 'childhood_street', prompt: '你童年时住的那条街叫什么？' },
  { key: 'first_school', prompt: '你就读的第一所学校叫什么？' },
  { key: 'mother_maiden_name', prompt: '你母亲的婚前姓氏是什么？' },
  { key: 'favorite_teacher', prompt: '你最喜欢的一位老师姓什么？' },
  { key: 'first_concert', prompt: '你看的第一场演出/演唱会是谁的？' },
  { key: 'childhood_nickname', prompt: '你小时候的绰号是什么？' },
  { key: 'memorable_gift', prompt: '你收到过最难忘的礼物是什么？' },
  { key: 'first_job_city', prompt: '你第一份工作所在的城市是？' },
  { key: 'favorite_book', prompt: '对你影响最大的一本书叫什么？' },
  { key: 'childhood_friend', prompt: '你儿时最好的朋友叫什么名字？' },
  { key: 'first_vehicle', prompt: '你的第一辆车/第一辆自行车是什么牌子？' },
];

const PROMPT_BY_KEY = new Map(SECURITY_QUESTION_CATALOG.map((q) => [q.key, q.prompt]));

export function isKnownQuestionKey(key: string): boolean {
  return PROMPT_BY_KEY.has(key);
}

export function questionPrompt(key: string): string {
  return PROMPT_BY_KEY.get(key) ?? key;
}
