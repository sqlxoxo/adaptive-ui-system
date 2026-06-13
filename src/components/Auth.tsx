import React, { useState } from "react";
import { Lock, User, Key, Eye, EyeOff, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";

interface AuthProps {
  onAuthSuccess: (token: string, user: { id: string; username: string; name: string; level: string }) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); // Новий стан
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!username.trim() || !password) {
      setError("Будь ласка, заповніть усі обов'язкові поля!");
      return;
    }

    if (!isLogin && !name.trim()) {
      setError("Будь ласка, введіть ваше ім'я!");
      return;
    }

    // Перевірка співпадіння паролів при реєстрації
    if (!isLogin && password !== confirmPassword) {
      setError("Паролі не співпадають!");
      return;
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const payload = isLogin 
        ? { username, password } 
        : { username, name, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Щось пішло не так. Спробуйте ще раз.");
      }

      if (isLogin) {
        setSuccess("Вхід успішний! Завантаження...");
        setTimeout(() => {
          onAuthSuccess(data.token, data.user);
        }, 800);
      } else {
        setSuccess("Реєстрація успішна! Тепер ви можете увійти.");
        setIsLogin(true);
        setName("");
        setPassword("");
        setConfirmPassword(""); // Очистити підтвердження
      }
    } catch (err: any) {
      setError(err.message || "Помилка зв'язку з сервером.");
    } finally {
      setLoading(false);
    }
  };

  // Скидання помилки при зміні полів (опціонально)
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (error === "Паролі не співпадають!") setError("");
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    if (error === "Паролі не співпадають!") setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-slate-100 via-slate-200 to-slate-300 dark:from-slate-950 dark:via-slate-900 dark:to-black p-4 transition-colors duration-500 font-sans">
      
      {/* Dynamic Background Elements */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-3xl pointer-events-none animate-pulse delay-700"></div>

      <div className="w-full max-w-md relative z-10">
        
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/30 dark:shadow-indigo-500/10 mb-4 animate-bounce">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Smart Task System
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Адаптивна система керування задачами з ШІ-телеметрією
          </p>
        </div>

        {/* Auth Box with Premium Glassmorphism */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-slate-800/40 shadow-2xl p-8 transition-all duration-300">
          
          {/* Tabs */}
          <div className="flex bg-slate-200/50 dark:bg-slate-800/40 p-1.5 rounded-2xl mb-8">
            <button
              onClick={() => {
                setIsLogin(true);
                setError("");
                setSuccess("");
                setConfirmPassword("");
              }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 cursor-pointer ${
                isLogin
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Вхід
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setError("");
                setSuccess("");
                setConfirmPassword("");
              }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 cursor-pointer ${
                !isLogin
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Реєстрація
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Display Name Input (Only on Register) */}
            {!isLogin && (
              <div className="space-y-1.5 animate-fadeIn">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                  Ваше ім'я
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Наприклад: Олександр"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all font-sans"
                  />
                </div>
              </div>
            )}

            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                Логін (username)
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="Введіть ваш логін"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all font-sans"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                Пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Введіть пароль"
                  value={password}
                  onChange={handlePasswordChange}
                  className="w-full pl-11 pr-11 py-3 bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input (Only on Register) */}
            {!isLogin && (
              <div className="space-y-1.5 animate-fadeIn">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                  Підтвердіть пароль
                </label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Підтвердіть пароль"
                    value={confirmPassword}
                    onChange={handleConfirmPasswordChange}
                    className="w-full pl-11 pr-11 py-3 bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all font-sans"
                  />
                </div>
              </div>
            )}

            {/* Notifications Alert Container */}
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl text-sm animate-shake">
                <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-start gap-2.5 p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl text-sm animate-fadeIn">
                <CheckCircle2 className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-2xl font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 dark:shadow-indigo-500/5 hover:-translate-y-0.5 active:translate-y-0 active:scale-99 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                loading ? "opacity-75 cursor-not-allowed" : ""
              }`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : isLogin ? (
                <>Ввійти в систему</>
              ) : (
                <>Зареєструватись</>
              )}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
