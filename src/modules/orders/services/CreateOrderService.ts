import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateProductService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('User not found');
    }

    const idProducts = products.map(product => {
      return { id: product.id };
    });

    const productsExists = await this.productsRepository.findAllById(
      idProducts,
    );

    if (!productsExists || productsExists.length !== products.length) {
      throw new AppError('Any products is not exists');
    }

    products.forEach(productRecept => {
      productsExists.forEach(productInfo => {
        if (
          productRecept.id === productInfo.id &&
          productRecept.quantity > productInfo.quantity
        ) {
          throw new AppError(
            `Product ${productRecept.id} without balance`,
            400,
          );
        }
      });
    });

    const productsToOrder = productsExists.map(productInfo => {
      const productQuantity = products.find(
        productFind => productInfo.id === productFind.id,
      );

      return {
        product_id: productInfo.id,
        price: productInfo.price,
        quantity: productQuantity?.quantity || 0,
      };
    });

    const order = await this.ordersRepository.create({
      products: productsToOrder,
      customer,
    });

    // console.log(order);

    const productUpdateQuantity = products.map(productRecept => {
      const currentQuantityProduct = productsExists.find(
        product => product.id === productRecept.id,
      );

      if (!currentQuantityProduct) {
        throw new Error('Error to find product');
      }

      return {
        id: currentQuantityProduct.id,
        quantity: currentQuantityProduct.quantity - productRecept.quantity,
      };
    });

    await this.productsRepository.updateQuantity(productUpdateQuantity);

    return order;
  }
}

export default CreateProductService;
