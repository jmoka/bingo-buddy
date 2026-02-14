import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { generateCardId } from '@/utils/bingoUtils';
import { BingoCard } from '@/types/bingo';
import { Upload, Loader2, Camera, X, Check, AlertCircle, Settings } from 'lucide-react';

const WEBHOOK_URL_KEY = 'bingo_webhook_url';
const DEFAULT_WEBHOOK_URL = 'https://jota-empresas-n8n.ubjifz.easypanel.host/webhook/345fb697-6712-4532-acc9-44188f6dd8b7';

interface ImageCardUploadProps {
  onAddCard: (card: BingoCard) => void;
}

export const ImageCardUpload = ({ onAddCard }: ImageCardUploadProps) => {
  const [name, setName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedNumbers, setExtractedNumbers] = useState<number[][] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(() => 
    localStorage.getItem(WEBHOOK_URL_KEY) || DEFAULT_WEBHOOK_URL
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveWebhookUrl = (url: string) => {
    setWebhookUrl(url);
    localStorage.setItem(WEBHOOK_URL_KEY, url);
  };

  const processImage = async (imageData: string) => {
    setIsProcessing(true);
    setError('');
    setExtractedNumbers(null);

    try {
      console.log('Sending image to webhook...');

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageData,
          filename: 'cartela.jpg',
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook retornou status ${response.status}`);
      }

      const data = await response.json();
      console.log('Webhook response:', data);

      if (!data.numbers || !Array.isArray(data.numbers) || data.numbers.length !== 5) {
        throw new Error('Resposta do webhook não contém uma matriz 5x5 válida');
      }

      // Validate grid
      for (const row of data.numbers) {
        if (!Array.isArray(row) || row.length !== 5) {
          throw new Error('Resposta do webhook não contém uma matriz 5x5 válida');
        }
      }

      setExtractedNumbers(data.numbers);
    } catch (err) {
      console.error('Webhook Error:', err);
      setError(`Erro ao processar: ${err instanceof Error ? err.message : 'Erro desconhecido'}. Verifique a URL do webhook e tente novamente.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione uma imagem.');
      return;
    }

    setError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result as string;
      setImagePreview(imageData);
      processImage(imageData);
    };
    reader.onerror = () => {
      setError('Erro ao ler o arquivo. Tente novamente.');
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    if (!extractedNumbers) return;

    if (!name.trim()) {
      setError('Digite o nome da cartela');
      return;
    }

    const card: BingoCard = {
      id: generateCardId(),
      name: name.trim(),
      numbers: extractedNumbers,
      markedNumbers: new Set(),
    };

    onAddCard(card);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setImagePreview(null);
    setExtractedNumbers(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="card-container">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-lg text-foreground">
          Adicionar via Imagem
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setShowSettings(!showSettings)}
          className="h-8 w-8"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-4">
        {showSettings && (
          <div className="space-y-2 p-3 bg-secondary rounded-lg">
            <label className="text-xs text-muted-foreground font-medium">
              URL do Webhook (n8n)
            </label>
            <Input
              placeholder="https://seu-n8n.com/webhook/..."
              value={webhookUrl}
              onChange={(e) => saveWebhookUrl(e.target.value)}
              className="bg-background border-0 text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Envio: POST com <code>{`{ "image": "base64...", "filename": "..." }`}</code><br />
              Retorno esperado: <code>{`{ "numbers": [[5x5]] }`}</code> (0 = FREE)
            </p>
          </div>
        )}

        <div>
          <Input
            placeholder="Nome da cartela (ex: Cartela 1)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-secondary border-0"
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {!imagePreview && (
          <Button
            type="button"
            variant="outline"
            className="w-full h-24 border-dashed border-2 hover:bg-secondary/50"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">
                <Camera className="w-6 h-6 text-muted-foreground" />
                <Upload className="w-6 h-6 text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">
                Tirar foto ou selecionar imagem
              </span>
            </div>
          </Button>
        )}

        {imagePreview && (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview da cartela"
              className="w-full rounded-lg border border-border"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2"
              onClick={resetForm}
              disabled={isProcessing}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Enviando para processamento...</span>
          </div>
        )}

        {extractedNumbers && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Números extraídos (confirme se estão corretos):
            </p>
            <div className="grid grid-cols-5 gap-1 p-2 bg-secondary rounded-lg">
              {extractedNumbers.map((row, rowIndex) =>
                row.map((num, colIndex) => (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={`
                      aspect-square flex items-center justify-center text-sm font-bold rounded
                      ${rowIndex === 2 && colIndex === 2
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background'
                      }
                    `}
                  >
                    {rowIndex === 2 && colIndex === 2 ? 'FREE' : num}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-destructive animate-slide-up">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {extractedNumbers && (
          <Button
            type="button"
            className="w-full gradient-primary shadow-button"
            onClick={handleConfirm}
          >
            <Check className="w-4 h-4 mr-2" />
            Confirmar e Adicionar
          </Button>
        )}
      </div>
    </div>
  );
};
