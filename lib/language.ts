// 언어 감지 유틸리티
export type SupportedLanguage = 'ko' | 'en' | 'it'

export function detectLanguage(text: string): SupportedLanguage {
  if (!text || text.trim().length === 0) return 'en' // 기본값 영어

  // 한글 감지 (가장 우선): 완성형 음절 + 한글 자모(ㅋㅋ, ㅎㅎ 등)
  const koreanSyllables = /[가-힣]/
  const koreanJamo = /[ㄱ-ㅎㅏ-ㅣ]/
  if (koreanSyllables.test(text) || koreanJamo.test(text)) {
    return 'ko'
  }

  // 영어 일반 단어/구 패턴 (질문·답변에 자주 쓰이는 표현 포함)
  const englishCommonWords = /\b(the|is|are|was|were|have|has|had|do|does|did|will|would|should|could|can|may|might|this|that|these|those|there|here|what|where|when|why|how|who|which|and|or|but|not|no|yes|there is|there are|there was|there were|contents|content|portfolio|project|projects|designer|design|experience|skills|about|information|help|assistant|hello|hi|hey|result|results|increase|conversions|conversion|did the|what is|what are|so what)\b/i
  const hasEnglishWords = englishCommonWords.test(text)
  
  // 이탈리아어 전용 단어 (영어와 겹치지 않는 것 위주: ciao, grazie, cosa, dove, perché 등)
  const italianOnlyPattern = /\b(ciao|grazie|prego|scusa|per favore|perfavore|come stai|bene|male|cosa|dove|quando|perché|perchè|chi|quanto|italiano|italia|dimmi|raccontami|spiegami|parlami|progetto|progetti|esperienza|competenze|chi sei|cosa fai|come funziona|non ci sono|non c'è|vuoto|vuota|vuol dire|questo|questa|parli)\b/i
  const hasItalianOnlyWords = italianOnlyPattern.test(text)
  
  // 이탈리아어 특수 문자 패턴 (è, é, à, ò, ù 등) → 이탈리아어 강한 신호
  const italianChars = /[èéàòùì]/i
  const hasItalianChars = italianChars.test(text) && !koreanSyllables.test(text) && !koreanJamo.test(text)

  // 이탈리아어 강한 신호(특수문자)가 있으면 이탈리아어
  if (hasItalianChars) return 'it'
  // 영어 문장이면 영어 (did the, what is, the design 등) → 사용자 질문 언어 우선
  if (hasEnglishWords) return 'en'
  // 이탈리아어 전용 단어가 있으면 이탈리아어
  if (hasItalianOnlyWords) return 'it'

  // 기본값 영어
  return 'en'
}

// IP 기반 국가 코드 감지 (간단한 매핑)
export function getCountryFromIP(ip: string | null): string | null {
  if (!ip) return null
  
  // 실제로는 GeoIP 서비스를 사용해야 하지만, 여기서는 간단한 예시
  // 실제 구현 시에는 MaxMind GeoIP2나 ipapi.co 같은 서비스 사용 권장
  return null // 일단 null 반환, 나중에 구현
}

// 국가별 인사말
export const greetings: Record<string, Record<SupportedLanguage, string>> = {
  // 한국
  KR: {
    ko: '안녕하세요!',
    en: 'Hello!',
    it: 'Ciao!',
  },
  // 미국, 영국, 캐나다 등
  US: {
    ko: '안녕하세요!',
    en: 'Hello!',
    it: 'Ciao!',
  },
  GB: {
    ko: '안녕하세요!',
    en: 'Hello!',
    it: 'Ciao!',
  },
  CA: {
    ko: '안녕하세요!',
    en: 'Hello!',
    it: 'Ciao!',
  },
  // 이탈리아
  IT: {
    ko: '안녕하세요!',
    en: 'Hello!',
    it: 'Ciao!',
  },
  // 기본값
  default: {
    ko: '안녕하세요!',
    en: 'Hello!',
    it: 'Ciao!',
  },
}

export function getGreeting(countryCode: string | null, language: SupportedLanguage): string {
  if (countryCode && greetings[countryCode]) {
    return greetings[countryCode][language]
  }
  return greetings.default[language]
}
