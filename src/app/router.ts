import { useEffect, useState } from "react";
export const navigate = (path: string) => {
  window.location.hash = path;
};
export function useRoute() {
  const [route, setRoute] = useState(location.hash.slice(1) || "/");
  useEffect(() => {
    const change = () => {
      setRoute(location.hash.slice(1) || "/");
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  return route;
}
