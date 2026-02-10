import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { generateCardId } from '@/utils/bingoUtils';
import { BingoCard } from '@/types/bingo';
import { Upload, Loader2, Camera, X, Check, AlertCircle } from 'lucide-react';
import Tesseract from 'tesseract.js';

interface ImageCardUploadProps {
  onAddCard: (card: BingoCard) => void;
}

export const ImageCardUpload = ({ onAddCard }: ImageCardUploadProps) => {
  const [name, setName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedNumbers, setExtractedNumbers] = useState<number[][] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractNumbersFromText = (text: string): number[][] | null => {
    console.log('Raw OCR text:', text);
    
    // Extract only numbers from the OCR text (ignore ALL words/symbols)
    const allMatches = text.match(/\d+/g) || [];
    console.log('All number matches:', allMatches);
    
    // Keep only valid bingo numbers (1-75)
    const numbers = allMatches
      .map(n => parseInt(n, 10))
      .filter(n => n >= 1 && n <= 75);
    
    console.log('Valid bingo numbers (1-75):', numbers);
    
    if (numbers.length < 24) {
      console.log(`Only found ${numbers.length} valid numbers, need at least 24`);
      return null;
    }

    // Take first 24 valid numbers and build 5x5 grid
    // Center position [2][2] is ALWAYS 0 (FREE / any symbol)
    const validNumbers = numbers.slice(0, 24);
    const grid: number[][] = [];
    let idx = 0;

    for (let row = 0; row < 5; row++) {
      const rowNumbers: number[] = [];
      for (let col = 0; col < 5; col++) {
        if (row === 2 && col === 2) {
          rowNumbers.push(0); // Always FREE
        } else {
          rowNumbers.push(validNumbers[idx++]);
        }
      }
      grid.push(rowNumbers);
    }

    console.log('Created grid:', grid);
    return grid;
  };

  const preprocessImage = (imageData: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.max(1, 2000 / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d')!;
        
        // Draw scaled image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Convert to grayscale and apply threshold (binarize)
        const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageDataObj.data;
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          const bw = gray < 140 ? 0 : 255; // Threshold
          data[i] = bw;
          data[i + 1] = bw;
          data[i + 2] = bw;
        }
        ctx.putImageData(imageDataObj, 0, 0);
        
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = imageData;
    });
  };

  const processImage = async (imageData: string) => {
    setIsProcessing(true);
    setError('');
    setExtractedNumbers(null);
    setProgress(0);

    try {
      console.log('Starting OCR processing...');
      
      // Preprocess: upscale + binarize for better OCR
      const processedImage = await preprocessImage(imageData);
      
      const result = await Tesseract.recognize(
        processedImage,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100));
            }
          },
        }
      );

      console.log('OCR Complete. Text:', result.data.text);

      const grid = extractNumbersFromText(result.data.text);
      
      if (!grid) {
        setError(`Não foi possível extrair 24 números válidos. Encontrados: ${(result.data.text.match(/\d+/g) || []).filter(n => {
          const num = parseInt(n, 10);
          return num >= 1 && num <= 75;
        }).length}. Tente uma foto mais nítida ou com melhor iluminação.`);
        return;
      }

      setExtractedNumbers(grid);
    } catch (err) {
      console.error('OCR Error:', err);
      setError(`Erro ao processar: ${err instanceof Error ? err.message : 'Erro desconhecido'}. Tente novamente.`);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('File selected:', file.name, file.type, file.size);

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione uma imagem.');
      return;
    }

    setError('');
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result as string;
      console.log('Image loaded, size:', imageData.length);
      setImagePreview(imageData);
      processImage(imageData);
    };
    reader.onerror = (err) => {
      console.error('FileReader error:', err);
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
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="card-container">
      <h3 className="font-heading font-semibold text-lg text-foreground mb-4">
        Adicionar via Imagem
      </h3>

      <div className="space-y-4">
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
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processando imagem... {progress}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              O processamento pode levar alguns segundos
            </p>
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
