// 进门页：填世界服务的地址（留空 = 跟页面同一个站点），连得上就进小世界
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { primaryEndpoint, setServer } from "../store/useEndpoints";
import { worldApi } from "../api/ccBridge";
import s from "./Connect.module.css";

export default function Connect() {
  const nav = useNavigate();
  const [url, setUrl] = useState(primaryEndpoint().url);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setMsg("");
    setServer(url);
    try { await worldApi.state(primaryEndpoint()); nav("/world"); }
    catch (e) { setMsg(`连不上：${(e as Error).message || "服务没开？"}`); }
    finally { setBusy(false); }
  };
  return (
    <div className={s.page}>
      <h1 className={s.title}>小世界</h1>
      <p className={s.sub}>一个一直在转的小钓鱼世界</p>
      <label className={s.field}>
        <span>世界服务地址</span>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="留空 = 本站（例：http://127.0.0.1:29901）" />
      </label>
      <button type="button" className={s.go} disabled={busy} onClick={() => void go()}>{busy ? "连接中…" : "进去"}</button>
      {msg && <p className={s.err}>{msg}</p>}
    </div>
  );
}
