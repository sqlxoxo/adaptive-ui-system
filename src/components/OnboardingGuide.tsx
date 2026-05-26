import React from "react";
import { Sparkles, HelpCircle, ArrowRight, CheckCircle2 } from "lucide-react";

interface OnboardingGuideProps {
  score: number;
}

export default function OnboardingGuide({ score }: OnboardingGuideProps) {
  const steps = [
    {
      title: "Створення першої задачі",
      desc: "Натисніть велику зелену кнопку '+ Створити задачу' або затисніть гарячу клавішу 'N'.",
      tip: "Спробуйте без помилок валідації назви для більшої оцінки!",
    },
    {
      title: "Перетягування чи переміщення",
      desc: "Ви можете перетягувати картки або використовувати прості кнопки дій для зміни статусу (To Do, In Progress, Done).",
      tip: "Це оновлює робочий статус вашої команди в реальному часі.",
    },
    {
      title: "Вивчення гарячих клавіш (Hotkeys)",
      desc: "Система автоматично аналізує швидкість вашої роботи. Чим частіше ви використовуєте гарячі клавіші, тим швидше інтерфейс адаптується під Експерта.",
      tip: "Натисніть 'N' (нова задача), 'Esc' (закрити модалку) або 'S' (фокус на пошук).",
    },
  ];

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-slate-900/70 dark:to-orange-950/15 border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-5 mb-6 shadow-sm relative overflow-hidden transition-all duration-300">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/10 dark:bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
      
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded-lg">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-amber-900 dark:text-amber-300 text-base">
              Інтерактивний посібник новачка (Novice Guide)
            </h3>
            <span className="text-xs bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-100 px-2.5 py-0.5 rounded-full font-medium">
              Активний крок
            </span>
          </div>
          <p className="text-sm text-amber-800 dark:text-amber-400 mt-1 max-w-2xl">
            Вітаємо в розумній системі! Ми помітили, що ви знайомитеся з інтерфейсом. 
            Ось 3 прості кроки, щоб підвищити вашу майстерність понад 50 балів (Зараз: <strong className="text-amber-900 dark:text-amber-300">{score}/100</strong>):
          </p>
 
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {steps.map((step, idx) => (
              <div 
                key={idx} 
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-amber-100 dark:border-amber-900/30 rounded-lg p-3.5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 text-amber-950 dark:text-amber-100 font-medium text-sm mb-1.5">
                    <span className="flex items-center justify-center w-5 h-5 bg-amber-200 dark:bg-amber-900 rounded-full text-xs text-amber-900 dark:text-amber-100 font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <span className="line-clamp-1">{step.title}</span>
                  </div>
                  <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
                <div className="mt-3.5 pt-2 border-t border-amber-100/60 dark:border-amber-900/30 flex items-center gap-1 text-[11px] text-amber-700/80 dark:text-amber-400/80 italic font-medium">
                  <HelpCircle className="w-3.5 h-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
                  <span>{step.tip}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
