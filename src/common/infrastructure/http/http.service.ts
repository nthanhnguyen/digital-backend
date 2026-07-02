import { Injectable } from '@nestjs/common';
import { HttpService as AxiosHttpService } from '@nestjs/axios';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class HttpService {
  constructor(private readonly httpService: AxiosHttpService) {}

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return firstValueFrom(this.httpService.get<T>(url, config));
  }

  async post<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return firstValueFrom(this.httpService.post<T>(url, data, config));
  }

  async put<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return firstValueFrom(this.httpService.put<T>(url, data, config));
  }

  async patch<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return firstValueFrom(this.httpService.patch<T>(url, data, config));
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return firstValueFrom(this.httpService.delete<T>(url, config));
  }
}
