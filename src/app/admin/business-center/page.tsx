"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  Edit3,
  ExternalLink,
  ImageIcon,
  Inbox,
  Loader2,
  Mail,
  Megaphone,
  RefreshCw,
  Save,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  AD_BANNER_PLACEMENTS,
  AD_PARTNER_STATUSES,
  BUSINESS_INQUIRY_STATUSES,
  BUSINESS_INQUIRY_TYPES,
} from "@/lib/business-center";

type Tab = "inquiries" | "partners" | "banners";
type Inquiry = {
  id: string;
  inquiryType: string;
  companyName: string;
  businessRegistrationNo: string;
  businessAddress: string;
  contactEmail: string | null;
  message: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
};
type Partner = {
  id: string;
  company_name: string;
  business_registration_no: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  status: string;
  note: string | null;
  created_at: string;
};
type Banner = {
  id: string;
  partner_id: string | null;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  mobile_image_url: string | null;
  target_url: string;
  alt_text: string | null;
  placement: string;
  priority: number;
  is_featured: boolean;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  advertising_partners?: { company_name?: string } | Array<{ company_name?: string }> | null;
};

const EMPTY_PARTNER = { companyName: "", businessRegistrationNo: "", contactName: "", contactEmail: "", contactPhone: "", website: "", status: "active", note: "" };
const EMPTY_BANNER = { partnerId: "", title: "", subtitle: "", imageUrl: "", mobileImageUrl: "", targetUrl: "", altText: "", placement: "home_mid", priority: "100", isFeatured: false, isActive: true, startsAt: "", endsAt: "" };

function adminHeaders(): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${typeof window === "undefined" ? "" : localStorage.getItem("admin_token") || ""}` };
}

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function BusinessCenterAdminPage() {
  const [tab, setTab] = useState<Tab>("inquiries");
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [partnerForm, setPartnerForm] = useState(EMPTY_PARTNER);
  const [bannerForm, setBannerForm] = useState(EMPTY_BANNER);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [inquiryResponse, adResponse] = await Promise.all([
        fetch("/api/admin/business-inquiries", { headers: adminHeaders() }),
        fetch("/api/admin/advertising", { headers: adminHeaders() }),
      ]);
      if (inquiryResponse.status === 401 || adResponse.status === 401) {
        setMessage("관리자 인증이 필요합니다. 다시 로그인해주세요.");
        return;
      }
      const [inquiryData, adData] = await Promise.all([inquiryResponse.json(), adResponse.json()]);
      if (!inquiryResponse.ok) throw new Error(inquiryData.error || "문의 목록 조회 실패");
      if (!adResponse.ok) throw new Error(adData.error || "광고 데이터 조회 실패");
      setInquiries(inquiryData.inquiries || []);
      setPartners(adData.partners || []);
      setBanners(adData.banners || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    newInquiries: inquiries.filter((item) => item.status === "new").length,
    activePartners: partners.filter((item) => item.status === "active").length,
    activeBanners: banners.filter((item) => item.is_active).length,
  }), [banners, inquiries, partners]);

  const saveInquiry = async (inquiry: Inquiry) => {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/business-inquiries", { method: "PATCH", headers: adminHeaders(), body: JSON.stringify({ id: inquiry.id, status: inquiry.status, adminNote: inquiry.adminNote || "" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "저장 실패");
      setMessage(`${inquiry.companyName} 문의 상태를 저장했습니다.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "저장 실패"); }
    finally { setSaving(false); }
  };

  const createPartner = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/advertising", { method: "POST", headers: adminHeaders(), body: JSON.stringify({ entity: "partner", ...partnerForm }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "광고주 등록 실패");
      setPartners((current) => [data.partner, ...current]);
      setPartnerForm(EMPTY_PARTNER);
      setMessage("광고 업체를 등록했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "등록 실패"); }
    finally { setSaving(false); }
  };

  const updatePartnerStatus = async (partner: Partner, status: string) => {
    setPartners((current) => current.map((item) => item.id === partner.id ? { ...item, status } : item));
    const response = await fetch("/api/admin/advertising", { method: "PATCH", headers: adminHeaders(), body: JSON.stringify({ entity: "partner", id: partner.id, status }) });
    if (!response.ok) { setMessage("광고주 상태를 저장하지 못했습니다."); void load(); }
  };

  const saveBanner = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const payload = { entity: "banner", ...bannerForm, startsAt: bannerForm.startsAt ? new Date(bannerForm.startsAt).toISOString() : null, endsAt: bannerForm.endsAt ? new Date(bannerForm.endsAt).toISOString() : null };
      const response = await fetch("/api/admin/advertising", { method: editingBannerId ? "PATCH" : "POST", headers: adminHeaders(), body: JSON.stringify(editingBannerId ? { ...payload, id: editingBannerId } : payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "배너 저장 실패");
      setBannerForm(EMPTY_BANNER);
      setEditingBannerId(null);
      setMessage(editingBannerId ? "배너 설정을 수정했습니다." : "배너를 등록했습니다.");
      await load();
      setTab("banners");
    } catch (error) { setMessage(error instanceof Error ? error.message : "배너 저장 실패"); }
    finally { setSaving(false); }
  };

  const editBanner = (banner: Banner) => {
    setEditingBannerId(banner.id);
    setBannerForm({
      partnerId: banner.partner_id || "", title: banner.title, subtitle: banner.subtitle || "", imageUrl: banner.image_url || "", mobileImageUrl: banner.mobile_image_url || "", targetUrl: banner.target_url, altText: banner.alt_text || "", placement: banner.placement, priority: String(banner.priority), isFeatured: banner.is_featured, isActive: banner.is_active, startsAt: toLocalDateTime(banner.starts_at), endsAt: toLocalDateTime(banner.ends_at),
    });
    setTab("banners");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (entity: "partner" | "banner", id: string) => {
    if (!window.confirm("이 항목을 삭제할까요?")) return;
    const response = await fetch(`/api/admin/advertising?entity=${entity}&id=${encodeURIComponent(id)}`, { method: "DELETE", headers: adminHeaders() });
    if (!response.ok) { const data = await response.json(); setMessage(data.error || "삭제 실패"); return; }
    if (entity === "partner") setPartners((current) => current.filter((item) => item.id !== id));
    else setBanners((current) => current.filter((item) => item.id !== id));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/32">Business operation</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">비즈니스·광고 센터</h1><p className="mt-2 text-sm text-black/45">협업 문의, 광고 업체, 배너 노출 위치와 순서를 한 곳에서 관리합니다.</p></div>
        <button type="button" onClick={() => void load()} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 text-xs font-bold"><RefreshCw className="h-3.5 w-3.5" />새로고침</button>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2">
        <Metric icon={Inbox} label="신규 문의" value={counts.newInquiries} />
        <Metric icon={Building2} label="활성 광고주" value={counts.activePartners} />
        <Metric icon={Megaphone} label="노출 배너" value={counts.activeBanners} />
      </div>

      <div className="mt-5 flex gap-1 overflow-x-auto rounded-2xl border border-black/[0.07] bg-white p-1.5">
        {([['inquiries', '문의·등록'], ['partners', '광고 업체'], ['banners', '배너 배치']] as Array<[Tab, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`h-10 shrink-0 rounded-xl px-4 text-xs font-bold ${tab === value ? "bg-black text-white" : "text-black/45 hover:bg-black/[0.04] hover:text-black"}`}>{label}</button>)}
      </div>
      {message && <div className="mt-4 rounded-2xl bg-black px-4 py-3 text-xs font-semibold text-white">{message}</div>}

      {loading ? <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-black/30" /></div> : null}

      {!loading && tab === "inquiries" && (
        <section className="mt-5 space-y-3">
          {inquiries.length === 0 ? <Empty icon={Inbox} text="접수된 비즈니스 문의가 없습니다." /> : inquiries.map((inquiry) => (
            <article key={inquiry.id} className="rounded-[22px] border border-black/[0.07] bg-white p-4 sm:p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-bold text-white">{BUSINESS_INQUIRY_TYPES.find((item) => item.value === inquiry.inquiryType)?.shortLabel || inquiry.inquiryType}</span><span className="text-[10px] text-black/35">{new Date(inquiry.createdAt).toLocaleString("ko-KR")}</span></div><h2 className="mt-3 text-lg font-semibold">{inquiry.companyName}</h2><p className="mt-1 text-xs text-black/44">{inquiry.businessRegistrationNo} · {inquiry.businessAddress}</p>{inquiry.contactEmail && <a href={`mailto:${inquiry.contactEmail}`} className="mt-2 inline-flex items-center gap-1 text-xs font-bold"><Mail className="h-3.5 w-3.5" />{inquiry.contactEmail}</a>}</div>
                <select value={inquiry.status} onChange={(event) => setInquiries((current) => current.map((item) => item.id === inquiry.id ? { ...item, status: event.target.value } : item))} className="h-10 rounded-xl border border-black/10 bg-white px-3 text-xs font-bold">{BUSINESS_INQUIRY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
              </div>
              <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-[#f7f7f5] p-4 text-xs leading-6 text-black/62">{inquiry.message}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row"><textarea value={inquiry.adminNote || ""} onChange={(event) => setInquiries((current) => current.map((item) => item.id === inquiry.id ? { ...item, adminNote: event.target.value } : item))} rows={2} placeholder="관리자 메모" className="min-h-12 flex-1 resize-none rounded-2xl border border-black/10 px-3 py-2 text-xs outline-none focus:border-black/30" /><button type="button" onClick={() => void saveInquiry(inquiry)} disabled={saving} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-black px-5 text-xs font-bold text-white"><Save className="h-3.5 w-3.5" />상태·메모 저장</button></div>
            </article>
          ))}
        </section>
      )}

      {!loading && tab === "partners" && (
        <section className="mt-5 grid items-start gap-5 xl:grid-cols-[0.82fr_1.18fr]">
          <form onSubmit={createPartner} className="rounded-[22px] border border-black/[0.07] bg-white p-5 xl:sticky xl:top-20"><h2 className="text-lg font-semibold">광고 업체 등록</h2><p className="mt-1 text-xs text-black/42">배너와 연결할 광고주를 먼저 등록합니다.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><AdminInput label="업체명" required value={partnerForm.companyName} onChange={(value) => setPartnerForm((current) => ({ ...current, companyName: value }))} /><AdminInput label="사업자등록번호" value={partnerForm.businessRegistrationNo} onChange={(value) => setPartnerForm((current) => ({ ...current, businessRegistrationNo: value }))} /><AdminInput label="담당자" value={partnerForm.contactName} onChange={(value) => setPartnerForm((current) => ({ ...current, contactName: value }))} /><AdminInput label="담당자 이메일" type="email" value={partnerForm.contactEmail} onChange={(value) => setPartnerForm((current) => ({ ...current, contactEmail: value }))} /><AdminInput label="연락처" value={partnerForm.contactPhone} onChange={(value) => setPartnerForm((current) => ({ ...current, contactPhone: value }))} /><AdminInput label="웹사이트" value={partnerForm.website} onChange={(value) => setPartnerForm((current) => ({ ...current, website: value }))} /></div><label className="mt-3 block"><span className="text-[11px] font-bold text-black/48">메모</span><textarea value={partnerForm.note} onChange={(event) => setPartnerForm((current) => ({ ...current, note: event.target.value }))} rows={3} className="mt-1.5 w-full resize-none rounded-2xl border border-black/10 p-3 text-xs outline-none" /></label><button type="submit" disabled={saving} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-black text-xs font-bold text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}광고 업체 등록</button></form>
          <div className="space-y-3">{partners.length === 0 ? <Empty icon={Building2} text="등록된 광고 업체가 없습니다." /> : partners.map((partner) => <article key={partner.id} className="rounded-[22px] border border-black/[0.07] bg-white p-4"><div className="flex items-start gap-3"><span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-black text-white"><Building2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><h3 className="font-semibold">{partner.company_name}</h3><p className="mt-1 truncate text-[11px] text-black/38">{partner.contact_name || "담당자 미등록"} · {partner.contact_email || "이메일 미등록"}</p></div>{partner.website && <a href={partner.website} target="_blank" rel="noopener noreferrer" className="p-2 text-black/35"><ExternalLink className="h-4 w-4" /></a>}<button type="button" onClick={() => void remove("partner", partner.id)} className="p-2 text-black/25 hover:text-black"><Trash2 className="h-4 w-4" /></button></div><div className="mt-4 flex items-center justify-between gap-3"><select value={partner.status} onChange={(event) => void updatePartnerStatus(partner, event.target.value)} className="h-9 rounded-xl border border-black/10 px-3 text-xs font-bold">{AD_PARTNER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select><span className="text-[10px] text-black/30">{new Date(partner.created_at).toLocaleDateString("ko-KR")}</span></div></article>)}</div>
        </section>
      )}

      {!loading && tab === "banners" && (
        <section className="mt-5 grid items-start gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={saveBanner} className="rounded-[22px] border border-black/[0.07] bg-white p-5 xl:sticky xl:top-20"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold">{editingBannerId ? "배너 설정 수정" : "배너 등록"}</h2><p className="mt-1 text-xs text-black/42">선노출은 일반 배너보다 먼저, 우선순위 숫자가 클수록 먼저 보입니다.</p></div>{editingBannerId && <button type="button" onClick={() => { setEditingBannerId(null); setBannerForm(EMPTY_BANNER); }} className="p-2"><X className="h-4 w-4" /></button>}</div><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="text-[11px] font-bold text-black/48">광고 업체</span><select value={bannerForm.partnerId} onChange={(event) => setBannerForm((current) => ({ ...current, partnerId: event.target.value }))} className="mt-1.5 h-11 w-full rounded-2xl border border-black/10 px-3 text-xs"><option value="">업체 연결 안 함</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.company_name}</option>)}</select></label><AdminInput label="배너 제목" required value={bannerForm.title} onChange={(value) => setBannerForm((current) => ({ ...current, title: value }))} className="sm:col-span-2" /><AdminInput label="보조 설명" value={bannerForm.subtitle} onChange={(value) => setBannerForm((current) => ({ ...current, subtitle: value }))} className="sm:col-span-2" /><AdminInput label="데스크톱 이미지 URL" value={bannerForm.imageUrl} onChange={(value) => setBannerForm((current) => ({ ...current, imageUrl: value }))} className="sm:col-span-2" /><AdminInput label="모바일 이미지 URL" value={bannerForm.mobileImageUrl} onChange={(value) => setBannerForm((current) => ({ ...current, mobileImageUrl: value }))} className="sm:col-span-2" /><AdminInput label="클릭 연결 URL" required value={bannerForm.targetUrl} onChange={(value) => setBannerForm((current) => ({ ...current, targetUrl: value }))} className="sm:col-span-2" /><label className="block sm:col-span-2"><span className="text-[11px] font-bold text-black/48">노출 위치</span><select value={bannerForm.placement} onChange={(event) => setBannerForm((current) => ({ ...current, placement: event.target.value }))} className="mt-1.5 h-11 w-full rounded-2xl border border-black/10 px-3 text-xs">{AD_BANNER_PLACEMENTS.map((placement) => <option key={placement.value} value={placement.value}>{placement.label}</option>)}</select></label><AdminInput label="우선순위" type="number" value={bannerForm.priority} onChange={(value) => setBannerForm((current) => ({ ...current, priority: value }))} /><AdminInput label="대체텍스트" value={bannerForm.altText} onChange={(value) => setBannerForm((current) => ({ ...current, altText: value }))} /><AdminInput label="노출 시작" type="datetime-local" value={bannerForm.startsAt} onChange={(value) => setBannerForm((current) => ({ ...current, startsAt: value }))} /><AdminInput label="노출 종료" type="datetime-local" value={bannerForm.endsAt} onChange={(value) => setBannerForm((current) => ({ ...current, endsAt: value }))} /></div><div className="mt-4 flex flex-wrap gap-4"><CheckBox label="선노출" checked={bannerForm.isFeatured} onChange={(checked) => setBannerForm((current) => ({ ...current, isFeatured: checked }))} /><CheckBox label="활성" checked={bannerForm.isActive} onChange={(checked) => setBannerForm((current) => ({ ...current, isActive: checked }))} /></div><button type="submit" disabled={saving} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-black text-xs font-bold text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{editingBannerId ? "배너 설정 저장" : "배너 등록"}</button></form>
          <div className="space-y-3">{banners.length === 0 ? <Empty icon={ImageIcon} text="등록된 배너가 없습니다." /> : banners.map((banner) => { const partnerRelation = Array.isArray(banner.advertising_partners) ? banner.advertising_partners[0] : banner.advertising_partners; return <article key={banner.id} className="overflow-hidden rounded-[22px] border border-black/[0.07] bg-white"><div className="grid sm:grid-cols-[150px_1fr]">{banner.image_url ? <img src={banner.image_url} alt="" className="h-full min-h-32 w-full object-cover" /> : <div className="flex min-h-32 items-center justify-center bg-[#f2f2f0]"><ImageIcon className="h-6 w-6 text-black/18" /></div>}<div className="p-4"><div className="flex flex-wrap items-center gap-1.5">{banner.is_featured && <span className="inline-flex items-center gap-1 rounded-full bg-black px-2 py-1 text-[9px] font-bold text-white"><Star className="h-2.5 w-2.5 fill-white" />선노출</span>}<span className={`rounded-full px-2 py-1 text-[9px] font-bold ${banner.is_active ? "bg-emerald-50 text-emerald-700" : "bg-black/[0.05] text-black/38"}`}>{banner.is_active ? "활성" : "비활성"}</span><span className="rounded-full bg-black/[0.05] px-2 py-1 text-[9px] font-bold text-black/45">우선 {banner.priority}</span></div><h3 className="mt-3 font-semibold">{banner.title}</h3><p className="mt-1 text-[11px] text-black/42">{AD_BANNER_PLACEMENTS.find((item) => item.value === banner.placement)?.label || banner.placement}</p>{partnerRelation?.company_name && <p className="mt-1 text-[10px] text-black/30">{partnerRelation.company_name}</p>}<div className="mt-4 flex gap-2"><button type="button" onClick={() => editBanner(banner)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/10 px-3 text-[11px] font-bold"><Edit3 className="h-3.5 w-3.5" />편집</button><button type="button" onClick={() => void remove("banner", banner.id)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold text-black/40 hover:bg-black/[0.04] hover:text-black"><Trash2 className="h-3.5 w-3.5" />삭제</button></div></div></div></article>; })}</div>
        </section>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Inbox; label: string; value: number }) { return <div className="rounded-[18px] border border-black/[0.07] bg-white p-4"><Icon className="h-4 w-4 text-black/35" /><p className="mt-5 text-2xl font-semibold">{value}</p><p className="mt-1 text-[10px] font-bold text-black/35">{label}</p></div>; }
function Empty({ icon: Icon, text }: { icon: typeof Inbox; text: string }) { return <div className="rounded-[22px] border border-dashed border-black/12 bg-white py-16 text-center"><Icon className="mx-auto h-6 w-6 text-black/18" /><p className="mt-3 text-xs text-black/38">{text}</p></div>; }
function AdminInput({ label, value, onChange, type = "text", required, className = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; className?: string }) { return <label className={`block ${className}`}><span className="text-[11px] font-bold text-black/48">{label}{required && <span className="ml-1 text-black/25">필수</span>}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} className="mt-1.5 h-11 w-full rounded-2xl border border-black/10 px-3 text-xs outline-none focus:border-black/30" /></label>; }
function CheckBox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="inline-flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-black" />{label}</label>; }
