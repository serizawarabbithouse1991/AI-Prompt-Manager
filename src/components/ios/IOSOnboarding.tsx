import { useState } from "react";
import { markOnboardingComplete } from "@/lib/onboardingPrefs";

type Slide = {
  title: string;
  body: string;
  icon: string;
};

const SLIDES: Slide[] = [
  {
    icon: "🖼️",
    title: "AI画像を一か所に",
    body: "写真ライブラリやファイルから NovelAI などの生成画像を取り込み、プロンプト付きで整理できます。",
  },
  {
    icon: "📁",
    title: "スマートコレクション",
    body: "プロンプトの character: タグやキーワードで、キャラクターごとに自動でコレクションへ振り分けます。",
  },
  {
    icon: "🔒",
    title: "写真へのアクセス",
    body: "取り込み時のみ写真ライブラリへアクセスします。選択した画像のコピーのみを端末内に保存し、ライブラリの写真を変更したり外部へ送信したりしません。",
  },
];

type Props = {
  onComplete: () => void;
};

export function IOSOnboarding({ onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  function handleNext() {
    if (isLast) {
      markOnboardingComplete();
      onComplete();
      return;
    }
    setIndex((prev) => prev + 1);
  }

  function handleSkip() {
    markOnboardingComplete();
    onComplete();
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-[var(--ios-bg)] text-neutral-100"
      style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}
    >
      <div className="flex justify-end px-4 pt-2">
        <button type="button" onClick={handleSkip} className="text-sm text-blue-400">
          スキップ
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="mb-6 text-6xl" aria-hidden>
          {slide.icon}
        </div>
        <h1 className="mb-3 text-2xl font-semibold">{slide.title}</h1>
        <p className="max-w-sm text-base leading-relaxed text-neutral-400">{slide.body}</p>
      </div>

      <div className="flex flex-col items-center gap-6 px-8 pb-8">
        <div className="flex gap-2" aria-label={`ステップ ${index + 1} / ${SLIDES.length}`}>
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={[
                "h-2 rounded-full transition-all",
                i === index ? "w-6 bg-blue-500" : "w-2 bg-neutral-600",
              ].join(" ")}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={handleNext}
          className="w-full max-w-sm rounded-xl bg-blue-500 py-3.5 text-base font-medium text-white"
        >
          {isLast ? "はじめる" : "次へ"}
        </button>
      </div>
    </div>
  );
}
