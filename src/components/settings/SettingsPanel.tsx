'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  User,
  Mail,
  Lock,
  Bell,
  Shield,
  HelpCircle,
  Eye,
  EyeOff,
  MessageSquare,
  ChevronRight,
  ExternalLink,
  Bug,
  Headphones,
  Smartphone,
  KeyRound,
} from 'lucide-react'

interface SettingsPanelProps {
  email?: string
  username?: string | null
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer focus:outline-none',
        on ? 'bg-primary' : 'bg-neutral-400',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-neutral-100 shadow transform transition-transform duration-200',
          on ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-300/20 bg-neutral-200 overflow-hidden mb-4">
      {children}
    </div>
  )
}

function SectionHeader({
  icon: Icon,
  label,
  color = 'text-primary',
}: {
  icon: React.ElementType
  label: string
  color?: string
}) {
  return (
    <div className="flex items-center gap-2 px-5 py-3 border-b border-neutral-300/20">
      <Icon size={15} className={color} />
      <span className="text-sm font-semibold text-neutral-700">{label}</span>
    </div>
  )
}

function RowLink({
  icon: Icon,
  label,
  sub,
  href,
  external,
}: {
  icon: React.ElementType
  label: string
  sub?: string
  href: string
  external?: boolean
}) {
  const cls =
    'flex items-center gap-3 px-5 py-3.5 hover:bg-neutral-300/20 transition-colors cursor-pointer border-b border-neutral-300/10 last:border-0'
  const inner = (
    <>
      <div className="w-8 h-8 rounded-xl bg-neutral-300/30 flex items-center justify-center shrink-0">
        <Icon size={15} className="text-neutral-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-800 leading-tight">{label}</p>
        {sub && <p className="text-xs text-neutral-500 mt-0.5 truncate">{sub}</p>}
      </div>
      {external ? (
        <ExternalLink size={14} className="text-neutral-500" />
      ) : (
        <ChevronRight size={14} className="text-neutral-500" />
      )}
    </>
  )
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    )
  }
  return (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  )
}

function RowToggle({
  icon: Icon,
  label,
  sub,
  value,
  onChange,
}: {
  icon: React.ElementType
  label: string
  sub?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-neutral-300/10 last:border-0">
      <div className="w-8 h-8 rounded-xl bg-neutral-300/30 flex items-center justify-center shrink-0">
        <Icon size={15} className="text-neutral-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-800 leading-tight">{label}</p>
        {sub && <p className="text-xs text-neutral-500 mt-0.5">{sub}</p>}
      </div>
      <Toggle on={value} onChange={onChange} />
    </div>
  )
}

function SecurityCard({
  icon: Icon,
  label,
  sub,
  subColor,
}: {
  icon: React.ElementType
  label: string
  sub: string
  subColor?: string
}) {
  return (
    <div className="flex-1 rounded-xl border border-neutral-300/20 bg-neutral-100 p-4 cursor-pointer hover:border-primary/30 transition-colors">
      <Icon size={18} className="text-neutral-600 mb-2" />
      <p className="text-sm font-semibold text-neutral-800">{label}</p>
      <p className={['text-xs mt-0.5', subColor ?? 'text-neutral-500'].join(' ')}>{sub}</p>
    </div>
  )
}

export default function SettingsPanel({ email, username }: SettingsPanelProps) {
  const t = useTranslations('settings')

  const [incognito, setIncognito] = useState(false)
  const [interactionLimits, setInteractionLimits] = useState(true)
  const [pushNotifs, setPushNotifs] = useState(true)
  const [streamAlerts, setStreamAlerts] = useState(false)
  const [directMessages, setDirectMessages] = useState(true)

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-neutral-900 mb-1" style={{ fontFamily: 'var(--font-headline)' }}>
        {t('title')}
      </h1>
      <p className="text-sm text-neutral-500 mb-6">{t('subtitle')}</p>

      {/* Account */}
      <SectionCard>
        <SectionHeader icon={User} label={t('account.title')} />
        <RowLink
          icon={User}
          label={t('account.profileIdentity')}
          sub={t('account.profileIdentitySub')}
          href="/settings/profile/edit"
        />
        <RowLink
          icon={Mail}
          label={t('account.emailPhone')}
          sub={email}
          href="/settings/profile/edit"
        />
      </SectionCard>

      {/* Privacy */}
      <SectionCard>
        <SectionHeader icon={Lock} label={t('privacy.title')} color="text-secondary" />
        <RowToggle
          icon={EyeOff}
          label={t('privacy.incognito')}
          sub={t('privacy.incognitoSub')}
          value={incognito}
          onChange={setIncognito}
        />
        <RowToggle
          icon={Eye}
          label={t('privacy.interactionLimits')}
          sub={t('privacy.interactionLimitsSub')}
          value={interactionLimits}
          onChange={setInteractionLimits}
        />
      </SectionCard>

      {/* Security */}
      <SectionCard>
        <SectionHeader icon={Shield} label={t('security.title')} color="text-tertiary" />
        <div className="flex gap-3 p-4">
          <SecurityCard
            icon={KeyRound}
            label={t('security.password')}
            sub={t('security.passwordSub')}
          />
          <SecurityCard
            icon={Smartphone}
            label={t('security.twoFactor')}
            sub={t('security.twoFactorStatus')}
            subColor="text-primary"
          />
        </div>
      </SectionCard>

      {/* Notifications */}
      <SectionCard>
        <SectionHeader icon={Bell} label={t('notifications.title')} color="text-secondary" />
        <RowToggle
          icon={Bell}
          label={t('notifications.push')}
          value={pushNotifs}
          onChange={setPushNotifs}
        />
        <RowToggle
          icon={MessageSquare}
          label={t('notifications.streamAlerts')}
          value={streamAlerts}
          onChange={setStreamAlerts}
        />
        <RowToggle
          icon={MessageSquare}
          label={t('notifications.directMessages')}
          value={directMessages}
          onChange={setDirectMessages}
        />
      </SectionCard>

      {/* Help & Support */}
      <SectionCard>
        <SectionHeader icon={HelpCircle} label={t('help.title')} color="text-primary" />
        <RowLink
          icon={ExternalLink}
          label={t('help.communityGuidelines')}
          href="#"
          external
        />
        <RowLink icon={Bug} label={t('help.reportBug')} href="#" external />
        <RowLink icon={Headphones} label={t('help.contactSupport')} href="#" external />
      </SectionCard>
    </div>
  )
}
