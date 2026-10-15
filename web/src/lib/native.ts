// 开源版：网页里没有原生壳，转屏之类的都是空操作
export const native = {
  async setOrientation(_landscape: boolean) { /* 网页里没法锁方向 */ },
};
export const isNativeShell = false;
