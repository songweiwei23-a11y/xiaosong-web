export default function LoginLayout({ children }: { children: React.ReactNode }) {
  // 这里原本还挂了一个悬浮的外观开关，但登录页自己的顶栏里已经有一个。
  // 两者从小图标升级成带面板的按钮后，重复就很明显了，故移除这一个，
  // 保留顶栏里位置更合理的那个。
  return <>{children}</>;
}
