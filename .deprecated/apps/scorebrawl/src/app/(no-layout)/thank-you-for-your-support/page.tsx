"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Home } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function ThankYouForYourSupportPage() {
  return (
    <div className="flex justify-center items-center min-h-screen p-4 bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20">
      <Card className="w-full max-w-lg text-center shadow-xl border-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Image
                src="/buy-me-coffee.png"
                alt="Buy me a coffee"
                width={120}
                height={120}
                className="rounded-2xl shadow-lg"
              />
              <div className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 animate-pulse">
                <Heart className="h-4 w-4 text-white fill-current" />
              </div>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            Thank You!
          </CardTitle>
          <CardDescription className="text-lg text-gray-600 dark:text-gray-300 mt-2">
            Your support means the world to us
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="prose prose-sm dark:prose-invert text-center max-w-none">
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              Thanks to amazing supporters like you, we can keep building and improving Scorebrawl.
              Your contribution helps us maintain the servers, add new features, and keep the lights
              on!
            </p>
          </div>

          <div className="bg-gradient-to-r from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Your support helps us:</p>
            <ul className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-1 text-left">
              <li>• Keep servers running smoothly</li>
              <li>• Add exciting new features</li>
              <li>• Improve user experience</li>
              <li>• Maintain free access for everyone</li>
            </ul>
          </div>

          <div className="pt-4">
            <Link href="/">
              <Button className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-medium px-8 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg">
                <Home className="h-4 w-4 mr-2" />
                Back to Scorebrawl
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
