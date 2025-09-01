import axios from 'axios';
import { ENV } from '@/lib/env';

// 공통 Axios 인스턴스
export const api = axios.create({
  baseURL: ENV.API,
  withCredentials: false, // 헤더 토큰 방식 가정
});

// (선택) AccessToken 보관. 로그인 붙일 때 사용 예정.
let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => {
  accessToken = t;
};

api.interceptors.request.use(cfg => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

// 401 처리: Refresh 정책이 없으므로 로그인 페이지 유도(나중에 구현)
api.interceptors.response.use(
  r => r,
  err => Promise.reject(err)
);
