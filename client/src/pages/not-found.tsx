import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-bold">找不到這一頁</h1>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            這條路不存在。回到岔路口重新選擇吧。
          </p>
          <Link href="/">
            <Button variant="outline" className="mt-4">
              回首頁
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
