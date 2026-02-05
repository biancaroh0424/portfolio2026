import { redirect } from 'next/navigation'

/** 루트(/) 접속 시 로딩 화면 없이 바로 /home으로 이동 */
export default function RootPage() {
  redirect('/home')
}
