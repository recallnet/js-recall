import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useForm } from "react-hook-form";
import { Address } from "viem";
import { useAccount } from "wagmi";
import { z } from "zod";

import { useAddFile } from "@recallnet/sdkx/react/buckets";
import { Button } from "@recallnet/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui/components/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@recallnet/ui/components/form";
import { Input } from "@recallnet/ui/components/input";
import { Progress } from "@recallnet/ui/components/progress";
import { Switch } from "@recallnet/ui/components/switch";
import { Textarea } from "@recallnet/ui/components/textarea";
import { useToast } from "@recallnet/ui/hooks/use-toast";
import { cn } from "@recallnet/ui/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucketAddress: Address;
  prefix: string;
}

const formSchema = z.object({
  key: z.string().min(1),
  overwrite: z.boolean().optional(),
  file: z.instanceof(File),
  metadata: z
    .union([
      z.record(z.string(), z.string()),
      z.string().transform((val, ctx) => {
        console.log("val", val);
        try {
          if (val.length === 0) return val;
          const obj = JSON.parse(val);
          const record = z.record(z.string(), z.string()).parse(obj);
          return record;
        } catch (error) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
          return val;
        }
      }),
    ])
    .optional(),
  ttl: z.coerce.number().min(0),
});

export default function AddObjectDialog({
  open,
  onOpenChange,
  bucketAddress,
  prefix,
}: Props) {
  const { toast } = useToast();

  const { address: fromAddress } = useAccount();

  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      key: prefix,
      ttl: "" as unknown as number,
    },
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    maxFiles: 1,
    onDrop: (files) => {
      form.setValue("file", files[0]!);
      form.trigger("file");
    },
  });

  const file = form.watch("file");

  useEffect(() => {
    if (file) {
      const metadata = form.getValues("metadata");
      if (typeof metadata !== "string") {
        const metaObj = {
          ...metadata,
          ...(file.type ? { type: file.type } : {}),
          ...(file.size ? { size: `${file.size}` } : {}),
        };
        form.setValue("metadata", metaObj);
      }
    }
  }, [file, form]);

  const [progress, setProgress] = useState<number | undefined>(undefined);

  const { addFile, isPending, isSuccess, error } = useAddFile();

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (fromAddress === undefined) return;
    const metadata =
      typeof values.metadata === "string" ? undefined : values.metadata;
    addFile({
      bucket: bucketAddress,
      from: fromAddress,
      key: values.key,
      file: values.file,
      options: {
        metadata,
        overwrite: values.overwrite,
        ttl: BigInt(values.ttl),
        onUploadProgress: (progress) => {
          setProgress(progress);
        },
      },
    });
  }

  useEffect(() => {
    if (isSuccess) {
      router.push(`/buckets/${bucketAddress}/${form.getValues("key")}?object`);
    }
  }, [bucketAddress, form, isSuccess, router]);

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="space-y-4">
        <DialogHeader>
          <DialogTitle>Add Object</DialogTitle>
          <DialogDescription>
            Add a file from your computer to the bucket.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="key"
              render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-[min-content_auto] items-center gap-x-3 gap-y-2">
                    <FormLabel>Key</FormLabel>
                    <FormControl className="">
                      <Input
                        placeholder="key"
                        {...field}
                        disabled={isPending}
                      />
                    </FormControl>
                    <div></div>
                    <FormDescription>
                      Key to store the object under.
                    </FormDescription>
                    <div></div>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="overwrite"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-2">
                    <div className="">
                      <FormLabel>Overwrite</FormLabel>
                      <FormDescription>
                        Overwrite an existing object with the same key.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isPending}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>File</FormLabel>
                  <FormControl>
                    <div
                      {...getRootProps()}
                      className={cn(
                        "focus-visible:ring-ring flex flex-col items-center gap-6 border border-dashed p-6 text-center hover:cursor-pointer focus-visible:outline-none focus-visible:ring-1",
                        isDragActive && "bg-accent",
                      )}
                    >
                      <Input
                        id="file"
                        type="file"
                        disabled={isPending}
                        // {...field}
                        {...getInputProps({ onChange: field.onChange })}
                      />
                      {field.value ? (
                        <p className="text-sm">{field.value.name}</p>
                      ) : (
                        <p
                          className={cn(
                            "text-muted-foreground mt-0 text-sm",
                            isDragActive && "text-accent-foreground",
                          )}
                        >
                          Drag and drop a file here, or click to select a file.
                        </p>
                      )}
                      {(isPending || isSuccess) && (
                        <Progress value={progress} className="h-1" />
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="metadata"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Metadata</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={JSON.stringify(
                        { key1: "value1", "...": "..." },
                        null,
                        2,
                      )}
                      {...field}
                      value={
                        typeof field.value === "object"
                          ? JSON.stringify(field.value)
                          : field.value
                      }
                      className="min-h-24"
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    Metadata is optional and must be a JSON object with string
                    property values.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ttl"
              render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-[min-content_auto] items-center gap-x-3 gap-y-2">
                    <FormLabel>TTL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="default"
                        {...field}
                        type="number"
                        disabled={isPending}
                      />
                    </FormControl>
                    <div></div>
                    <FormDescription>
                      Time to live for the object in hours.
                    </FormDescription>
                    <div></div>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />} Submit
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
