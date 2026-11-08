import { useEffect, useState } from "react";

const KEY = "meucaixa.theme";
type Theme = "light" | "dark";

function apply(t: Theme) {
  const root = document.documentElement;
  if (t === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = (localStorage.getItem(KEY) as Theme | null) ?? "dark";
    setTheme(stored);
    apply(stored);
  }, []);

  const set = (t: Theme) => {
    localStorage.setItem(KEY, t);
    setTheme(t);
    apply(t);
  };

  return [theme, set];
}
