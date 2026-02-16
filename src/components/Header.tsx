import { Circle } from 'lucide-react';

export const Header = () => {
  return (
    <header className="gradient-hero py-8 px-4">
      <div className="container max-w-6xl mx-auto">
        <div className="flex items-center justify-center gap-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Circle
                key={i}
                className="w-3 h-3 fill-white/80 text-white/80"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-white tracking-tight">
            Bingo
          </h1>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Circle
                key={i}
                className="w-3 h-3 fill-white/80 text-white/80"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        </div>
        <p className="text-center text-white/80 mt-2 font-body">
          Marque suas cartelas e acompanhe os vencedores!
        </p>
      </div>
    </header>
  );
};
