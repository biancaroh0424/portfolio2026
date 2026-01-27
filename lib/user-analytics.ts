// 사용자 정보 수집 유틸리티

interface UserInfo {
  userId: string // 고유 사용자 ID (MAC ID 대신 사용)
  location: {
    country?: string
    city?: string
    timezone?: string
  }
  device: {
    type: 'desktop' | 'mobile' | 'tablet'
    os: string
    browser: string
    userAgent: string
  }
}

// 고유 사용자 ID 생성/가져오기 (localStorage 기반)
function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return 'unknown'
  
  const STORAGE_KEY = 'user_analytics_id'
  let userId = localStorage.getItem(STORAGE_KEY)
  
  if (!userId) {
    // 고유 ID 생성 (timestamp + random)
    userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
    localStorage.setItem(STORAGE_KEY, userId)
  }
  
  return userId
}

// Device 정보 파싱
function getDeviceInfo(): UserInfo['device'] {
  if (typeof window === 'undefined') {
    return {
      type: 'desktop',
      os: 'unknown',
      browser: 'unknown',
      userAgent: 'unknown'
    }
  }
  
  const ua = navigator.userAgent
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop'
  let os = 'unknown'
  let browser = 'unknown'
  
  // Device 타입 감지
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = 'tablet'
  } else if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) {
    deviceType = 'mobile'
  }
  
  // OS 감지
  if (/windows/i.test(ua)) os = 'Windows'
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS'
  else if (/linux/i.test(ua)) os = 'Linux'
  else if (/android/i.test(ua)) os = 'Android'
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS'
  
  // Browser 감지
  if (/edg/i.test(ua)) browser = 'Edge'
  else if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome'
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari'
  else if (/firefox/i.test(ua)) browser = 'Firefox'
  else if (/opera|opr/i.test(ua)) browser = 'Opera'
  
  return {
    type: deviceType,
    os,
    browser,
    userAgent: ua
  }
}

// Location 정보 가져오기 (IP 기반 또는 Geolocation)
async function getLocationInfo(): Promise<UserInfo['location']> {
  const location: UserInfo['location'] = {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  }
  
  // IP 기반 위치 정보는 서버에서 가져와야 하므로, 여기서는 timezone만 반환
  // 실제 위치 정보는 서버에서 IP 기반으로 가져올 수 있음
  
  // Geolocation API 사용 (사용자 동의 필요)
  if (typeof window !== 'undefined' && 'geolocation' in navigator) {
    try {
      // 주의: 실제로는 사용자 동의가 필요하므로, 여기서는 timezone만 사용
      // 필요시 서버에서 IP 기반 위치 정보를 가져올 수 있음
    } catch (error) {
      console.warn('Geolocation error:', error)
    }
  }
  
  return location
}

// 사용자 정보 수집
export async function collectUserInfo(): Promise<UserInfo> {
  const userId = getOrCreateUserId()
  const device = getDeviceInfo()
  const location = await getLocationInfo()
  
  return {
    userId,
    location,
    device
  }
}

// 사용자 정보를 간단한 형태로 반환 (서버 전송용)
export async function getUserInfoForAnalytics(): Promise<{
  userId: string
  location: string
  device: string
  deviceType: string
  os: string
  browser: string
}> {
  const info = await collectUserInfo()
  
  return {
    userId: info.userId,
    location: info.location.timezone || 'unknown',
    device: `${info.device.type}-${info.device.os}-${info.device.browser}`,
    deviceType: info.device.type,
    os: info.device.os,
    browser: info.device.browser
  }
}
