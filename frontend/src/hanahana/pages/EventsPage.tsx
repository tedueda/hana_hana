import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Crown, MapPin, Users, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cancelEventRegistration, eventErrorCode, fetchEvents, registerEvent, type EventRow, type EventScope } from '../api/premium';
import { formatDate, useI18n } from '../i18n';
import type { MessageKey } from '../i18n/ja';
import { useErrorMessage } from '../hooks';
import { PageHeader } from './SettingsPage';

const hm = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const EventCard: React.FC<{ ev: EventRow; onChanged: () => void }> = ({ ev, onChanged }) => {
  const { t, lang, locale } = useI18n();
  const { toast } = useToast();
  const errText = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const ko = lang === 'ko';
  const title = ko ? ev.title_ko : ev.title_ja;
  const desc = ko ? ev.description_ko : ev.description_ja;
  const loc = ko ? ev.location_ko : ev.location_ja;
  const registered = ev.my_status === 'registered';
  const remaining = ev.capacity != null ? Math.max(0, ev.capacity - Number(ev.registered_count)) : null;
  const full = remaining === 0;
  const canceled = !!ev.canceled_at;
  const started = new Date(ev.starts_at).getTime() <= Date.now();
  const notOpen = new Date(ev.open_at).getTime() > Date.now();

  const act = async (fn: () => Promise<void>, okKey: MessageKey) => {
    setBusy(true);
    try {
      await fn();
      toast({ title: t(okKey) });
      onChanged();
    } catch (e) {
      const code = eventErrorCode(e);
      toast({ title: code ? t(`events.err.${code}` as MessageKey) : errText(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2" data-testid="event-card">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-bold leading-snug break-words">{title}</h2>
        {canceled && <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 shrink-0">{t('events.canceled')}</span>}
      </div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{desc}</p>
      <ul className="text-xs text-gray-600 space-y-1">
        <li className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />{formatDate(ev.starts_at, locale)} {hm(ev.starts_at)}{ev.ends_at ? ` – ${hm(ev.ends_at)}` : ''}</li>
        <li className="flex items-center gap-1.5">{ev.is_online ? <Wifi className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}{ev.is_online ? t('events.online') : loc}</li>
        {ev.capacity != null && (
          <li className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{t('events.capacity', { n: ev.capacity })} · {full ? t('events.full') : t('events.remaining', { n: remaining ?? 0 })}</li>
        )}
      </ul>
      <div className="flex items-end justify-between gap-2 pt-1">
        <div>
          <p className="text-[11px] text-gray-500">{t('events.myPrice')}</p>
          <p className="text-lg font-black text-rose-600 leading-none">
            {ev.my_price_jpy === 0 ? t('events.free') : t('events.price', { n: ev.my_price_jpy.toLocaleString() })}
          </p>
          {ev.my_discount_pct > 0 && ev.price_jpy > 0 && (
            <p className="text-[11px] text-amber-700 flex items-center gap-1"><Crown className="w-3 h-3" />{t('events.discount', { pct: ev.my_discount_pct })} · {t('events.basePrice', { n: ev.price_jpy.toLocaleString() })}</p>
          )}
        </div>
        {registered ? (
          <Button variant="outline" size="sm" disabled={busy || started} onClick={() => window.confirm(t('events.cancelConfirm')) && act(() => cancelEventRegistration(ev.id), 'events.canceledToast')}>
            {t('events.cancel')}
          </Button>
        ) : (
          <Button size="sm" className="bg-rose-500 hover:bg-rose-600" disabled={busy || canceled || started || full || notOpen} onClick={() => act(() => registerEvent(ev.id), 'events.registeredToast')}>
            {t('events.register')}
          </Button>
        )}
      </div>
      {notOpen && !canceled && !started && (
        <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg px-2 py-1.5">{t('events.earlyAccessLocked', { date: `${formatDate(ev.open_at, locale)} ${hm(ev.open_at)}` })}</p>
      )}
      {registered && <p className="text-[11px] text-gray-500">{t('events.paymentNote')}</p>}
    </article>
  );
};

const EventsPage: React.FC = () => {
  const { t } = useI18n();
  const [scope, setScope] = useState<EventScope>('upcoming');
  const [rows, setRows] = useState<EventRow[] | null>(null);

  const reload = useCallback(() => {
    setRows(null);
    fetchEvents(scope).then(setRows).catch(() => setRows([]));
  }, [scope]);
  useEffect(reload, [reload]);

  return (
    <div className="space-y-4">
      <PageHeader title={t('events.title')} back="/app/profile" />
      <Tabs value={scope} onValueChange={(v) => setScope(v as EventScope)}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="upcoming">{t('events.tab.upcoming')}</TabsTrigger>
          <TabsTrigger value="mine">{t('events.tab.mine')}</TabsTrigger>
          <TabsTrigger value="past">{t('events.tab.past')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {rows === null && <p className="text-center text-gray-500 py-10">{t('common.loading')}</p>}
      {rows && rows.length === 0 && <p className="text-center text-gray-500 py-10">{t('events.empty')}</p>}
      <div className="space-y-3">{rows?.map((ev) => <EventCard key={ev.id} ev={ev} onChanged={reload} />)}</div>
    </div>
  );
};

export default EventsPage;
