import { Modal, Tag, Image, Spin } from 'antd';
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight, Receipt, Ban, CalendarDays, User, Landmark, Building2, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { accountsAPI } from '../services/api';
import dayjs from 'dayjs';

const fmt = (n) => `TZS ${(n || 0).toLocaleString()}`;

const Field = ({ label, children }) => (
  <div>
    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">{label}</span>
    <span className="text-sm text-slate-700">{children}</span>
  </div>
);

const AccountBadge = ({ icon: Icon, label, name, shop }) => (
  <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
    <div className="flex items-center gap-1.5 mb-1">
      <Icon size={14} className="text-brand-dark" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
    </div>
    <div className="text-sm font-semibold text-slate-700">{name || '—'}</div>
    <div className="text-xs text-slate-400">{shop || ''}</div>
  </div>
);

export default function TransactionDetailModal({ tx, open, onClose }) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['tx-detail', tx?.id],
    queryFn: () => accountsAPI.getTransaction(tx.id).then((r) => r.data.data),
    enabled: open && !!tx?.id,
    staleTime: 30_000,
  });

  const d = detail || tx;
  const isCancelled = d?.status === 'cancelled';
  const isTransfer = d?.reference_type === 'transfer';
  const isDeposit = d?.reference_type === 'adjustment' && d?.type === 'in';
  const isThisFromLeg = isTransfer && d?.transfer && d?.account_id === d.transfer.from_account_id;
  const grossAmount = (d?.amount || 0) + (d?.charges || 0);

  return (
    <Modal
      title={<span className="text-sm font-bold text-slate-700">Transaction Details <span className="text-slate-400 font-normal">#{d?.id || ''}</span></span>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      className="top-8"
    >
      {isLoading && !d ? (
        <div className="flex justify-center py-16"><Spin /></div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Status banner */}
          {isCancelled ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 flex items-start gap-3">
              <Ban size={18} className="text-rose-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-bold text-rose-700">Transaction Cancelled</div>
                {d.cancel_reason && <div className="text-xs text-rose-600 mt-0.5">Reason: {d.cancel_reason}</div>}
                <div className="text-[11px] text-rose-500 mt-0.5">
                  By {d.canceller?.name || '—'} · {d.cancelled_at ? dayjs(d.cancelled_at).format('DD MMM YYYY HH:mm') : ''}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {d?.type === 'in'
                  ? <ArrowUpRight size={18} className="text-emerald-600" />
                  : <ArrowDownRight size={18} className="text-red-600" />}
                <span className={`text-[11px] font-bold uppercase tracking-wider ${d?.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>{d?.type === 'in' ? 'Money In' : 'Money Out'}</span>
              </div>
              <Tag className="!text-[10px] !m-0">{d?.reference_type?.replace(/_/g, ' ')}</Tag>
            </div>
          )}

          {/* Amount */}
          <div className="text-center py-2">
            <div className={`text-3xl font-bold ${d?.type === 'in' ? 'text-emerald-600' : 'text-red-600'} ${isCancelled ? 'line-through opacity-60' : ''}`}>
              {d?.type === 'in' ? '+' : '−'}{fmt(d?.amount)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {isCancelled ? 'Voided — balance already recalculated' : `Balance before: ${fmt(d?.balance_before)} → after: ${fmt(d?.balance_after)}`}
            </div>
          </div>

          {/* Transfer route */}
          {isTransfer && d?.transfer && (
            <div className="flex items-stretch gap-2">
              <AccountBadge icon={isThisFromLeg ? Landmark : Building2} label={isThisFromLeg ? 'From (this account)' : 'From'} name={d.transfer.fromAccount?.name} shop={d.transfer.fromAccount?.shop?.name} />
              <div className="flex items-center"><ArrowLeftRight size={16} className="text-brand-dark" /></div>
              <AccountBadge icon={isThisFromLeg ? Building2 : Landmark} label={isThisFromLeg ? 'To' : 'To (this account)'} name={d.transfer.toAccount?.name} shop={d.transfer.toAccount?.shop?.name} />
            </div>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Field label="Date"><CalendarDays size={12} className="inline mr-1 text-slate-300" />{d?.transaction_date ? dayjs(d.transaction_date).format('DD MMM YYYY') : '—'}</Field>
            <Field label="Recorded By"><User size={12} className="inline mr-1 text-slate-300" />{d?.recorder?.name || '—'}</Field>
            <Field label="Account"><Landmark size={12} className="inline mr-1 text-slate-300" />{d?.account?.name || '—'}{d?.account?.shop?.name ? ` (${d.account.shop.name})` : ''}</Field>
            <Field label="Payment Method">{d?.payment_method ? d.payment_method.replace(/_/g, ' ') : '—'}</Field>
            {isDeposit && (d?.charges || 0) > 0 && (
              <>
                <Field label="Gross Amount">{fmt(grossAmount)}</Field>
                <Field label="Charges">{fmt(d.charges)}</Field>
              </>
            )}
            {d?.reference_id && <Field label="Reference ID">#{d.reference_id}</Field>}
            <Field label="Status">
              {isCancelled ? <Tag color="red" className="!text-[10px]">Cancelled</Tag> : <Tag color="green" className="!text-[10px]">Active</Tag>}
            </Field>
          </div>

          {d?.description && (
            <div className="rounded-lg border border-slate-100 bg-white p-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1"><FileText size={11} className="inline mr-1" />Description</span>
              <p className="text-sm text-slate-600 m-0 whitespace-pre-wrap">{d.description}</p>
            </div>
          )}

          {/* Receipt photo */}
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2"><Receipt size={11} className="inline mr-1" />Attached Receipt</span>
            {d?.receipt_url ? (
              <Image src={d.receipt_url} alt="Receipt" className="rounded-lg max-h-64 object-contain border border-slate-200" />
            ) : (
              <div className="flex flex-col items-center justify-center h-32 bg-slate-50 rounded-lg text-slate-400 border border-slate-200">
                <Receipt className="w-8 h-8 mb-1" />
                <span className="text-xs">No receipt attached</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
