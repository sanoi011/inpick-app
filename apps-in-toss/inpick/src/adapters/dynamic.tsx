import { lazy, Suspense, type ComponentType } from "react";

type Loader = () => Promise<{ default: ComponentType<any> } | ComponentType<any>>;

export default function dynamic(
  loader: Loader,
  options?: { loading?: ComponentType },
) {
  const LazyComponent = lazy(async () => {
    const loaded = await loader();
    return typeof loaded === "function" ? { default: loaded } : loaded;
  });
  const Loading = options?.loading;

  return function DynamicComponent(props: Record<string, unknown>) {
    return (
      <Suspense fallback={Loading ? <Loading /> : null}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}
