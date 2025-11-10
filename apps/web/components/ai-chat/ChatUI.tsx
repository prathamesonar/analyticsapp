'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Bot } from "lucide-react";
import axios from 'axios';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
// import { api } from '@/lib/fetcher'; // This import was unused, so I've removed it.

interface Message {
  id: number;
  sender: 'user' | 'bot';
  text: string;
  sql?: string;
  data?: Record<string, any>[];
  explanation?: string;
  error?: string;
}

// Define the Vanna AI URL using the environment variable
// This will use your Vercel variable in production and fallback to localhost for development
const VANNA_AI_URL = process.env.NEXT_PUBLIC_VANNA_AI_URL || 'http://localhost:8000';

export function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { id: Date.now(), sender: 'user', text: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // *** UPDATED LINE ***
      // Call the Vanna AI backend using the environment variable
      const response = await axios.post(`${VANNA_AI_URL}/chat`, {
        message: userMessage.text
      });

      console.log('Response from Vanna:', response.data);

      const { response: aiResponse, sql, data, error } = response.data;

      if (error) {
        const botMessage: Message = {
          id: Date.now() + 1,
          sender: 'bot',
          text: "I encountered an error.",
          error: error
        };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        const botMessage: Message = {
          id: Date.now() + 1,
          sender: 'bot',
          text: aiResponse || "Here is the result of your query:",
          sql,
          data: data || [],
          explanation: undefined
        };
        setMessages((prev) => [...prev, botMessage]);
      }

    } catch (error: any) {
      console.error('Chat error:', error);
      const errorMessage = error.response?.data?.error || error.message || "An unexpected error occurred while processing your request.";
      const botMessage: Message = {
        id: Date.now() + 1,
        sender: 'bot',
        text: "I encountered an error.",
        error: errorMessage
      };
      setMessages((prev) => [...prev, botMessage]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const renderDataResult = (data: Record<string, any>[]) => {
    if (!data || data.length === 0) {
      return <p className='text-sm text-muted-foreground'>No results found for this query.</p>;
    }

    const columns = Object.keys(data[0]);

    return (
      <ScrollArea className="h-64 w-full rounded-md border mt-2">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col} className="px-2 py-1">{col.replace(/_/g, ' ')}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.slice(0, 20).map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((col) => {
                  const value = row[col];
                  let displayValue = '';

                  if (value === null || value === undefined) {
                    displayValue = '-';
                  } else if (typeof value === 'number') {
                    displayValue = value.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                  } else if (value instanceof Date) {
                    displayValue = new Date(value).toLocaleDateString('de-DE');
                  } else {
                    displayValue = String(value);
                  }

                  return (
                    <TableCell key={`${rowIndex}-${col}`} className="px-2 py-1 truncate max-w-[100px]">
                      {displayValue}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data.length > 20 && (
          <p className="text-xs text-muted-foreground p-2">Showing 20 of {data.length} results</p>
        )}
      </ScrollArea>
    );
  };

  return (
    <Card className="h-[700px] flex flex-col max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Bot className="w-6 h-6 mr-2 text-primary" /> Chat with Data
        </CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="flex-1 overflow-hidden p-6">
        <ScrollArea className="h-full pr-4" ref={scrollRef}>
          {messages.length === 0 && (
            <p className="text-center text-muted-foreground">Start by asking a question about your data...</p>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`mb-4 max-w-[85%] ${msg.sender === 'user' ? 'ml-auto' : 'mr-auto'}`}>
              <div
                className={`p-4 rounded-lg shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-900 border border-gray-200'
                }`}
              >
                <p className="font-semibold text-sm">{msg.sender === 'user' ? "You" : "AI Assistant"}</p>
                <p className="mt-2 text-sm">{msg.text}</p>

                {/* Bot Response Details */}
                {msg.sender === 'bot' && (
                  <>
                    {msg.sql && (
                      <div className="mt-3">
                        <Separator className="my-2 bg-gray-300" />
                        <p className="font-semibold text-xs text-gray-700 mt-2">Generated SQL:</p>
                        <pre className="bg-gray-200 p-2 rounded text-xs overflow-x-auto mt-1">
                          <code>{msg.sql}</code>
                        </pre>
                      </div>
                    )}

                    {msg.data && msg.data.length > 0 && (
                      <div className="mt-3">
                        <p className="font-semibold text-xs text-gray-700">Results ({msg.data.length} rows):</p>
                        {renderDataResult(msg.data)}
                      </div>
                    )}

                    {msg.error && (
                      <div className="mt-2 p-2 bg-red-100 rounded">
                        <p className="text-xs text-red-700">❌ Error: {msg.error}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center space-x-2 text-primary mt-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <p className="text-sm">Analyzing your question...</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
      <CardFooter>
        <form onSubmit={handleSubmit} className="flex w-full gap-2">
          <Input
            placeholder="Ask a question about your data..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading} size="sm">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
