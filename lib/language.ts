// 언어 감지 유틸리티
export type SupportedLanguage = 'ko' | 'en' | 'it'

export function detectLanguage(text: string): SupportedLanguage {
  if (!text || text.trim().length === 0) return 'en' // 기본값 영어

  // 한글 감지 (가장 우선)
  const koreanPattern = /[가-힣]/
  if (koreanPattern.test(text)) {
    return 'ko'
  }

  // 영어 일반 단어 패턴 (이탈리아어보다 우선)
  const englishCommonWords = /\b(the|is|are|was|were|have|has|had|do|does|did|will|would|should|could|can|may|might|this|that|these|those|there|here|what|where|when|why|how|who|which|and|or|but|not|no|yes|there is|there are|there was|there were|contents|content|portfolio|project|projects|designer|design|experience|skills|about|information|help|assistant|hello|hi|hey)\b/i
  const hasEnglishWords = englishCommonWords.test(text)
  
  // 이탈리아어 감지 (더 많은 패턴)
  const italianPattern = /\b(ciao|grazie|prego|scusa|per favore|perfavore|come|stai|bene|male|si|no|cosa|dove|quando|perché|perchè|chi|quanto|italiano|italia|dimmi|raccontami|spiegami|parlami|progetto|progetti|portfolio|designer|design|esperienza|competenze|chi sei|cosa fai|come funziona|non ci sono|non c'è|vuoto|vuota)\b/i
  const hasItalianWords = italianPattern.test(text)
  
  // 이탈리아어 특수 문자 패턴 (è, é, à, ò, ù 등)
  const italianChars = /[èéàòùì]/i
  const hasItalianChars = italianChars.test(text) && !koreanPattern.test(text)

  // 영어 단어가 있으면 영어 우선 (이탈리아어 단어가 있어도 영어가 더 많으면 영어)
  if (hasEnglishWords && !hasItalianWords) {
    return 'en'
  }
  
  // 이탈리아어 단어나 특수 문자가 있으면 이탈리아어
  if (hasItalianWords || hasItalianChars) {
    return 'it'
  }

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
