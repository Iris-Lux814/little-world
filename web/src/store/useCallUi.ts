// 开源版没有通话：一直是「没在打电话」（音乐不用让路）
export type CallView = "off";
export function getCallView(): CallView { return "off"; }
export function onCallView(_f: () => void): () => void { return () => {}; }
