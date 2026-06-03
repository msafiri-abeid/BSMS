// src/pages/auth/LoginPage.jsx
import { useState } from 'react';
import { Form, Input, Button, App } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import logo from '../../assets/logo.png';
import background from '../../assets/images/background.jpg';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { message } = App.useApp();
  const setAuth = useAuthStore(s => s.setAuth);

  const onFinish = async ({ email, password }) => {
    setLoading(true);
    try {
      const { data } = await authAPI.login({ email, password });
      const { user, accessToken, refreshToken } = data.data;
      setAuth(user, accessToken, refreshToken);
      message.success(`Welcome back, ${user.name}`);
      navigate('/');
    } catch (err) {
      message.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 bg-cover bg-center bg-no-repeat relative selection:bg-white/20"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(2, 21, 89, 0.7), rgba(2, 21, 89, 0.85)), url(${background})`,
      }}
    >
      {/* Login Container Card */}
      <div className="w-full max-w-[420px] bg-brand-dark/95 backdrop-blur-md rounded-2xl p-10 shadow-[0_24px_50px_rgba(0,0,0,0.6)] border border-white/10 custom-login-card">
        
        {/* Header / Logo section */}
        <div className="text-center mb-8">
          <div className="inline-block p-2 rounded-xl transition-transform duration-300 hover:scale-105">
            <img
              src={logo}
              alt="BentaBet Logo"
              className="w-24 h-24 mx-auto object-contain block drop-shadow-[0_4px_12px_rgba(255,255,255,0.1)]"
            />
          </div>
          <p className="mt-3 text-xs uppercase tracking-widest text-slate-400 font-medium">
            Slot Management System
          </p>
        </div>

        {/* Ant Form with custom tailwind-targeted structures */}
        <Form 
          layout="vertical" 
          onFinish={onFinish} 
          size="large" 
          requiredMark={false}
          className="space-y-4"
        >
          <Form.Item
            name="email"
            rules={[{ required: true, type: 'email', message: 'Please enter a valid email address' }]}
            className="mb-0"
          >
            <Input
              prefix={<UserOutlined className="text-slate-400 mr-1" />}
              placeholder="Email address"
              autoComplete="email"
              className="h-12 rounded-lg border-slate-300 placeholder:text-slate-400 focus:border-white focus:shadow-none hover:border-slate-200 transition-all"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please enter your password' }]}
            className="pt-1 mb-0"
          >
            <Input.Password
              prefix={<LockOutlined className="text-slate-400 mr-1" />}
              placeholder="Password"
              autoComplete="current-password"
              className="h-12 rounded-lg border-slate-300 placeholder:text-slate-400 focus:border-white focus:shadow-none hover:border-slate-200 transition-all"
            />
          </Form.Item>

          <Form.Item className="mb-0 pt-3">
            <Button
              type="default"
              htmlType="submit"
              loading={loading}
              block
              className="h-12 font-semibold text-white bg-transparent border-2 border-white rounded-lg hover:bg-white hover:text-brand-dark focus:bg-white focus:text-brand-dark transition-all duration-200 tracking-wide active:scale-[0.99]"
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        {/* Footer */}
        <div className="text-center mt-10">
          <p className="text-[11px] tracking-wider text-slate-400/80 font-light">
            BentaBet Ltd &middot; Dar es Salaam, Tanzania
          </p>
        </div>
      </div>
    </div>
  );
}