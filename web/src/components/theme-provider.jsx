import { ThemeProvider as NextThemesProvider } from "next-themes";

function ThemeProvider({ children }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="notebook-theme"
    >
      {children}
    </NextThemesProvider>
  );
}

export { ThemeProvider };
