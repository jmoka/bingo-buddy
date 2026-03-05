import { AppHeader } from './AppHeader';
import { Footer } from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="flex-grow container max-w-6xl mx-auto py-6 sm:py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
};